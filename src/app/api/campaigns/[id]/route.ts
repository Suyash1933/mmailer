import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      template: true,
      recipients: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!campaign || campaign.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(campaign);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
