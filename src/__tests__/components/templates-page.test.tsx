import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "1" }),
  usePathname: () => "/templates",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { email: "test@test.com" } }, status: "authenticated" }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("TemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const TemplatesPage = (await import("@/app/(app)/templates/page")).default;
    render(<TemplatesPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders templates after loading", async () => {
    const mockTemplates = [
      { id: "1", name: "Welcome Email", subject: "Welcome!", pdfPath: null, createdAt: new Date().toISOString() },
      { id: "2", name: "Follow-up", subject: "Following up", pdfPath: "uploads/doc.pdf", createdAt: new Date().toISOString() },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });

    const TemplatesPage = (await import("@/app/(app)/templates/page")).default;
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("Welcome Email")).toBeInTheDocument();
      expect(screen.getByText("Follow-up")).toBeInTheDocument();
    });
  });

  it("shows empty state when no templates", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const TemplatesPage = (await import("@/app/(app)/templates/page")).default;
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("No templates yet. Create your first email template.")).toBeInTheDocument();
    });
  });

  it("shows PDF badge for templates with attachments", async () => {
    const mockTemplates = [
      { id: "1", name: "With PDF", subject: "Sub", pdfPath: "uploads/doc.pdf", createdAt: new Date().toISOString() },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });

    const TemplatesPage = (await import("@/app/(app)/templates/page")).default;
    render(<TemplatesPage />);

    await waitFor(() => {
      expect(screen.getByText("PDF")).toBeInTheDocument();
    });
  });
});
