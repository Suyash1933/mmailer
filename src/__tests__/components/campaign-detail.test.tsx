import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: "campaign-1" }),
  usePathname: () => "/campaigns/campaign-1",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockCampaign = {
  id: "campaign-1",
  name: "Test Campaign",
  status: "draft",
  totalEmails: 3,
  sentCount: 0,
  failedCount: 0,
  scheduledAt: null,
  createdAt: new Date().toISOString(),
  template: { name: "Template A", subject: "Hello {{company_name}}" },
  recipients: [
    { id: "r1", email: "a@co.com", companyName: "Alpha", status: "pending", error: null, sentAt: null },
    { id: "r2", email: "b@co.com", companyName: "Beta", status: "pending", error: null, sentAt: null },
    { id: "r3", email: "c@co.com", companyName: "Gamma", status: "pending", error: null, sentAt: null },
  ],
};

describe("CampaignDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}), // Never resolves
    });

    const CampaignDetailPage = (await import("@/app/(app)/campaigns/[id]/page")).default;
    render(<CampaignDetailPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders campaign details after loading", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCampaign),
    });

    const CampaignDetailPage = (await import("@/app/(app)/campaigns/[id]/page")).default;
    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Campaign")).toBeInTheDocument();
      expect(screen.getByText("Send Now")).toBeInTheDocument();
    });
  });

  it("shows all recipients in table", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCampaign),
    });

    const CampaignDetailPage = (await import("@/app/(app)/campaigns/[id]/page")).default;
    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("a@co.com")).toBeInTheDocument();
      expect(screen.getByText("b@co.com")).toBeInTheDocument();
      expect(screen.getByText("c@co.com")).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
  });

  it("shows progress bar with correct stats", async () => {
    const sendingCampaign = {
      ...mockCampaign,
      status: "sending",
      sentCount: 2,
      failedCount: 0,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sendingCampaign),
    });

    const CampaignDetailPage = (await import("@/app/(app)/campaigns/[id]/page")).default;
    render(<CampaignDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("2 sent / 0 failed / 3 total")).toBeInTheDocument();
      expect(screen.getByText("sending")).toBeInTheDocument();
    });
  });
});
