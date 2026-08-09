import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../lib/prisma-mock";
import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

describe("GET /api/settings/smtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/settings/smtp/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns null when no config exists", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.smtpConfig.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/settings/smtp/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeNull();
  });

  it("returns config without password", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.smtpConfig.findFirst.mockResolvedValue({
      id: "1",
      email: "user@gmail.com",
      appPassword: "secret",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
    });

    const { GET } = await import("@/app/api/settings/smtp/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe("user@gmail.com");
    expect(data.hasPassword).toBe(true);
    expect(data.appPassword).toBeUndefined();
  });
});
