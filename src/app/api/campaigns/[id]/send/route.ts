import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      recipients: { where: { status: "pending" } },
    },
  });

  if (!campaign || campaign.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.status === "sending") {
    return NextResponse.json({ error: "Already sending" }, { status: 400 });
  }

  const smtpConfig = await prisma.smtpConfig.findUnique({
    where: { userEmail: session.user.email },
  });
  if (!smtpConfig || !smtpConfig.appPassword) {
    return NextResponse.json(
      { error: "SMTP not configured. Go to Settings first." },
      { status: 400 }
    );
  }

  if (campaign.recipients.length === 0) {
    return NextResponse.json({ error: "No pending recipients" }, { status: 400 });
  }

  await prisma.campaign.update({
    where: { id },
    data: { status: "sending" },
  });

  return NextResponse.json({ success: true, message: "Campaign queued for sending" });
}
