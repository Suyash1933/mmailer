import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.template.findMany({
    where: { userEmail: session.user.email },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  const label = formData.get("label") as string | null;
  const pdf = formData.get("pdf") as File | null;

  let pdfPath: string | null = null;
  if (pdf && pdf.size > 0) {
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const fileName = `${Date.now()}-${pdf.name}`;
    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await pdf.arrayBuffer());
    await writeFile(filePath, buffer);
    pdfPath = `uploads/${fileName}`;
  }

  const template = await prisma.template.create({
    data: { userEmail: session.user.email, name, subject, body, pdfPath, label: label || null },
  });

  return NextResponse.json(template);
}
