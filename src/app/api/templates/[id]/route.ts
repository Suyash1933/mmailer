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
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template || template.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing || existing.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  const pdf = formData.get("pdf") as File | null;

  let pdfPath = existing.pdfPath;
  let pdfData = existing.pdfData;

  if (pdf && pdf.size > 0) {
    const buffer = Buffer.from(await pdf.arrayBuffer());
    pdfPath = pdf.name; // Store original filename for display
    pdfData = buffer.toString("base64"); // Store content in DB (no filesystem)
  }

  const template = await prisma.template.update({
    where: { id },
    data: { name, subject, body, pdfPath, pdfData },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template || template.userEmail !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
