import { vi } from "vitest";

export const prismaMock = {
  campaign: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  campaignEmail: {
    createMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  template: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  smtpConfig: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
