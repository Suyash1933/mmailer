import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

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
  const label = formData.get("label") as string | null;
  const pdf = formData.get("pdf") as File | null;

  let pdfPath = existing.pdfPath;

  if (pdf && pdf.size > 0) {
    if (existing.pdfPath) {
      try {
        await unlink(path.join(process.cwd(), existing.pdfPath));
      } catch {}
    }
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const fileName = `${Date.now()}-${pdf.name}`;
    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await pdf.arrayBuffer());
    await writeFile(filePath, buffer);
    pdfPath = `uploads/${fileName}`;
  }

  const template = await prisma.template.update({
    where: { id },
    data: { name, subject, body, pdfPath, label: label || null },
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

  if (template.pdfPath) {
    try {
      await unlink(path.join(process.cwd(), template.pdfPath));
    } catch {}
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
