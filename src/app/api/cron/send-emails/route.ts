import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import nodemailer from "nodemailer";
import path from "path";
import { ImapFlow } from "imapflow";

export const maxDuration = 55; // Vercel function timeout (seconds)

const BATCH_SIZE = 1;          // 1 email per invocation
const EMAIL_GAP_SECONDS = 45;  // minimum gap between emails (enforced server-side)

export async function GET(req: Request) {
  // Allow access via cron secret (header or query param) OR authenticated user session
  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  const hasValidCronSecret =
    !cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret;

  if (!hasValidCronSecret) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Auto-start any scheduled campaigns whose time has arrived
  await prisma.campaign.updateMany({
    where: {
      status: "draft",
      scheduledAt: { lte: new Date() },
    },
    data: { status: "sending" },
  });

  // Find all campaigns that are currently sending
  const campaigns = await prisma.campaign.findMany({
    where: { status: "sending" },
    include: {
      template: true,
      recipients: {
        where: { status: "pending" },
        take: BATCH_SIZE,
      },
    },
  });

  if (campaigns.length === 0) {
    return NextResponse.json({ message: "No active campaigns" });
  }

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const campaign of campaigns) {
    if (campaign.recipients.length === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
      continue;
    }

    // Enforce 45-second gap between emails — safe even if cron-job.org
    // calls more frequently than once per minute (two staggered jobs, etc.)
    const lastSent = await prisma.campaignEmail.findFirst({
      where: { campaignId: campaign.id, status: "sent" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    if (lastSent?.sentAt) {
      const elapsed = (Date.now() - lastSent.sentAt.getTime()) / 1000;
      if (elapsed < EMAIL_GAP_SECONDS) {
        totalSkipped++;
        continue; // Too soon — wait for next invocation
      }
    }

    // Get SMTP config for this campaign's owner
    const smtpConfig = await prisma.smtpConfig.findUnique({
      where: { userEmail: campaign.userEmail },
    });
    if (!smtpConfig || !smtpConfig.appPassword) {
      continue;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort,
      secure: false,
      auth: { user: smtpConfig.userEmail, pass: smtpConfig.appPassword },
    });

    // Build PDF attachment from DB (base64) — works in serverless, no filesystem
    let attachments: nodemailer.SendMailOptions["attachments"] = [];
    if (campaign.template.pdfData) {
      const buffer = Buffer.from(campaign.template.pdfData, "base64");
      const filename = campaign.template.pdfPath
        ? path.basename(campaign.template.pdfPath)
        : "attachment.pdf";
      attachments = [{ filename, content: buffer }];
    }

    // Connect IMAP if template has a label
    let imapClient: ImapFlow | null = null;
    const gmailLabel = campaign.template.label;

    if (gmailLabel) {
      try {
        imapClient = new ImapFlow({
          host: "imap.gmail.com",
          port: 993,
          secure: true,
          auth: { user: smtpConfig.userEmail, pass: smtpConfig.appPassword },
          logger: false,
        });
        await imapClient.connect();
        try {
          await imapClient.mailboxCreate(gmailLabel);
        } catch {
          // Label already exists
        }
      } catch {
        imapClient = null;
      }
    }

    for (const recipient of campaign.recipients) {
      const subject = campaign.template.subject.replace(
        /\{\{company_name\}\}/g,
        recipient.companyName
      );
      const html = campaign.template.body.replace(
        /\{\{company_name\}\}/g,
        recipient.companyName
      );

      try {
        const info = await transporter.sendMail({
          from: smtpConfig.userEmail,
          to: recipient.email,
          subject,
          html,
          attachments,
        });

        totalSent++;
        await prisma.campaignEmail.update({
          where: { id: recipient.id },
          data: { status: "sent", sentAt: new Date() },
        });
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { sentCount: { increment: 1 } },
        });

        // Apply Gmail label via IMAP
        if (imapClient && gmailLabel && info.messageId) {
          try {
            const lock = await imapClient.getMailboxLock("[Gmail]/Sent Mail");
            try {
              const messageId = info.messageId.replace(/[<>]/g, "");
              const result = await imapClient.search(
                { header: { "Message-ID": messageId } },
                { uid: true }
              );
              if (result && Array.isArray(result) && result.length > 0) {
                await imapClient.messageCopy(result as number[], gmailLabel, { uid: true });
              }
            } finally {
              lock.release();
            }
          } catch {
            // Labeling failed — email was still sent
          }
        }
      } catch (e: unknown) {
        totalFailed++;
        const message = e instanceof Error ? e.message : "Unknown error";
        await prisma.campaignEmail.update({
          where: { id: recipient.id },
          data: { status: "failed", error: message },
        });
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        });
      }
    }

    if (imapClient) {
      try { await imapClient.logout(); } catch { /* ignore */ }
    }

    const remaining = await prisma.campaignEmail.count({
      where: { campaignId: campaign.id, status: "pending" },
    });
    if (remaining === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
    }
  }

  return NextResponse.json({
    processed: true,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
  });
}
