import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../lib/prisma-mock";
import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

describe("GET /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/templates/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns templates when authenticated", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });

    const mockTemplates = [
      { id: "1", name: "Template 1", subject: "Sub 1", body: "<p>Hi</p>", createdAt: new Date() },
      { id: "2", name: "Template 2", subject: "Sub 2", body: "<p>Hello</p>", createdAt: new Date() },
    ];
    prismaMock.template.findMany.mockResolvedValue(mockTemplates);

    const { GET } = await import("@/app/api/templates/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Template 1");
  });
});

describe("GET /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent template", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    prismaMock.template.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/templates/[id]/route");
    const request = new Request("http://localhost/api/templates/nonexistent");
    const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Not found");
  });

  it("returns template when found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@test.com" } });
    const mockTemplate = {
      id: "1",
      userEmail: "test@test.com",
      name: "Test",
      subject: "Subject",
      body: "<p>Body</p>",
      pdfPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prismaMock.template.findUnique.mockResolvedValue(mockTemplate);

    const { GET } = await import("@/app/api/templates/[id]/route");
    const request = new Request("http://localhost/api/templates/1");
    const response = await GET(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("Test");
  });
});
