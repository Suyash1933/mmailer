import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userEmail: session.user.email },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const templateId = formData.get("templateId") as string;
  const scheduledAt = formData.get("scheduledAt") as string | null;
  const file = formData.get("file") as File | null;
  const manualRecipients = formData.get("manualRecipients") as string | null;

  // Verify the template belongs to this user
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || template.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let validRows: { email: string; company_name: string }[] = [];

  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<{ email: string; company_name: string }>(sheet);
    validRows = rows.filter(
      (r) => r.email && r.company_name && r.email.includes("@")
    );
  } else if (manualRecipients) {
    const parsed = JSON.parse(manualRecipients);
    validRows = parsed.filter(
      (r: { email: string; company_name: string }) =>
        r.email && r.company_name && r.email.includes("@")
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "No valid recipients found. Each must have an email and company name." },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      userEmail: session.user.email,
      name,
      templateId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      totalEmails: validRows.length,
    },
  });

  await prisma.campaignEmail.createMany({
    data: validRows.map((r) => ({
      campaignId: campaign.id,
      email: r.email.trim(),
      companyName: r.company_name.trim(),
    })),
  });

  return NextResponse.json(campaign);
}
