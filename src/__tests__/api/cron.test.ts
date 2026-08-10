import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../lib/prisma-mock";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "<test@msg.id>" }),
    })),
  },
}));

vi.mock("imapflow", () => ({
  ImapFlow: vi.fn(),
}));

describe("GET /api/cron/send-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized with wrong secret", async () => {
    process.env.CRON_SECRET = "my-secret";

    const { GET } = await import("@/app/api/cron/send-emails/route");
    const request = new Request("http://localhost/api/cron/send-emails", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");

    delete process.env.CRON_SECRET;
  });

  it("returns no active campaigns when none are sending", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/cron/send-emails/route");
    const request = new Request("http://localhost/api/cron/send-emails");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("No active campaigns");
  });

  it("skips campaign when SMTP not configured", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      { id: "1", userEmail: "test@test.com", status: "sending", sentCount: 0, failedCount: 0, recipients: [{ id: "r1" }], template: {} },
    ]);
    prismaMock.campaignEmail.findFirst.mockResolvedValue(null);
    prismaMock.smtpConfig.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/cron/send-emails/route");
    const request = new Request("http://localhost/api/cron/send-emails");
    const response = await GET(request);
    const data = await response.json();

    // Cron skips campaigns without SMTP and returns success with 0 sent
    expect(response.status).toBe(200);
    expect(data.sent).toBe(0);
  });

  it("marks campaign completed when no pending recipients", async () => {
    prismaMock.campaign.findMany.mockResolvedValue([
      {
        id: "1",
        userEmail: "test@test.com",
        status: "sending",
        sentCount: 5,
        failedCount: 0,
        recipients: [],
        template: { subject: "Test", body: "<p>Hi</p>", pdfPath: null },
      },
    ]);
    prismaMock.campaign.update.mockResolvedValue({});

    const { GET } = await import("@/app/api/cron/send-emails/route");
    const request = new Request("http://localhost/api/cron/send-emails");
    const response = await GET(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { status: "completed" },
    });
  });
});
