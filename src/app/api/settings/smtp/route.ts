import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.smtpConfig.findUnique({
    where: { userEmail: session.user.email },
  });

  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    id: config.id,
    email: config.userEmail,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    hasPassword: !!config.appPassword,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appPassword, smtpHost, smtpPort } = await req.json();
  const userEmail = session.user.email;

  const existing = await prisma.smtpConfig.findUnique({
    where: { userEmail },
  });

  // If updating and no new password provided, keep the old one
  const finalPassword = appPassword || existing?.appPassword;
  if (!finalPassword) {
    return NextResponse.json({ error: "App password is required" }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: smtpPort || 587,
    secure: false,
    auth: { user: userEmail, pass: finalPassword },
  });

  try {
    await transporter.verify();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "SMTP verification failed: " + message },
      { status: 400 }
    );
  }

  await prisma.smtpConfig.upsert({
    where: { userEmail },
    update: {
      appPassword: finalPassword,
      smtpHost: smtpHost || "smtp.gmail.com",
      smtpPort: smtpPort || 587,
    },
    create: {
      userEmail,
      appPassword: finalPassword,
      smtpHost: smtpHost || "smtp.gmail.com",
      smtpPort: smtpPort || 587,
    },
  });

  return NextResponse.json({ success: true });
}
