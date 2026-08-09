import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../lib/prisma-mock";
import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

describe("GET /api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/campaigns/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns campaigns list when authenticated", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });

    const mockCampaigns = [
      {
        id: "1",
        userEmail: "test@test.com",
        name: "Campaign 1",
        status: "draft",
        totalEmails: 10,
        sentCount: 0,
        failedCount: 0,
        createdAt: new Date(),
        template: { name: "Template 1" },
      },
    ];
    prismaMock.campaign.findMany.mockResolvedValue(mockCampaigns);

    const { GET } = await import("@/app/api/campaigns/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Campaign 1");
  });
});

describe("GET /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent campaign", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const request = new Request("http://localhost/api/campaigns/nonexistent");
    const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });

  it("returns campaign with recipients", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    const mockCampaign = {
      id: "1",
      userEmail: "test@test.com",
      name: "Test Campaign",
      status: "draft",
      totalEmails: 2,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date(),
      template: { name: "Template", subject: "Sub" },
      recipients: [
        { id: "r1", email: "a@test.com", companyName: "Co A", status: "pending", error: null, sentAt: null },
        { id: "r2", email: "b@test.com", companyName: "Co B", status: "pending", error: null, sentAt: null },
      ],
    };
    prismaMock.campaign.findUnique.mockResolvedValue(mockCampaign);

    const { GET } = await import("@/app/api/campaigns/[id]/route");
    const request = new Request("http://localhost/api/campaigns/1");
    const response = await GET(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recipients).toHaveLength(2);
  });
});

describe("DELETE /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes campaign when authenticated", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue({ id: "1", userEmail: "test@test.com" });
    prismaMock.campaign.delete.mockResolvedValue({ id: "1" });

    const { DELETE } = await import("@/app/api/campaigns/[id]/route");
    const request = new Request("http://localhost/api/campaigns/1", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe("POST /api/campaigns/[id]/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent campaign", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/campaigns/[id]/send/route");
    const request = new Request("http://localhost/api/campaigns/x/send", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "x" }) });

    expect(response.status).toBe(404);
  });

  it("returns 400 if already sending", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: "1",
      userEmail: "test@test.com",
      status: "sending",
      recipients: [],
    });

    const { POST } = await import("@/app/api/campaigns/[id]/send/route");
    const request = new Request("http://localhost/api/campaigns/1/send", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Already sending");
  });

  it("queues campaign for sending", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: "1",
      userEmail: "test@test.com",
      status: "draft",
      recipients: [{ id: "r1", status: "pending" }],
    });
    prismaMock.smtpConfig.findUnique.mockResolvedValue({
      id: "s1",
      userEmail: "test@test.com",
      appPassword: "pass",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
    });
    prismaMock.campaign.update.mockResolvedValue({ id: "1", status: "sending" });

    const { POST } = await import("@/app/api/campaigns/[id]/send/route");
    const request = new Request("http://localhost/api/campaigns/1/send", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { status: "sending" },
    });
  });
});

describe("GET /api/campaigns/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns lightweight status data", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.campaign.findUnique.mockResolvedValue({
      userEmail: "test@test.com",
      status: "sending",
      sentCount: 5,
      failedCount: 1,
      totalEmails: 10,
    });

    const { GET } = await import("@/app/api/campaigns/[id]/status/route");
    const request = new Request("http://localhost/api/campaigns/1/status");
    const response = await GET(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sentCount).toBe(5);
    expect(data.failedCount).toBe(1);
    expect(data.totalEmails).toBe(10);
  });
});
