import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import nodemailer from "nodemailer";
import path from "path";

export const maxDuration = 55; // Vercel function timeout (seconds)

const BATCH_SIZE = 10;        // emails per cron invocation
const EMAIL_DELAY_MS = 3000;  // ms between emails within a batch (anti-spam pacing)

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function log(level: "INFO" | "WARN" | "ERROR", msg: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...data,
  };
  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// Strip HTML tags to generate a plain-text fallback (improves spam score)
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req: Request) {
  const invocationStart = Date.now();
  log("INFO", "Cron invocation started");

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
      log("WARN", "Unauthorized cron attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    log("INFO", "Authorized via user session", { user: session.user.email });
  } else {
    log("INFO", "Authorized via cron secret");
  }

  // Auto-start any scheduled campaigns whose time has arrived
  const autoStarted = await prisma.campaign.updateMany({
    where: {
      status: "draft",
      scheduledAt: { lte: new Date() },
    },
    data: { status: "sending" },
  });
  if (autoStarted.count > 0) {
    log("INFO", "Auto-started scheduled campaigns", { count: autoStarted.count });
  }

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

  log("INFO", "Active campaigns found", { count: campaigns.length });

  if (campaigns.length === 0) {
    log("INFO", "No active campaigns — exiting");
    return NextResponse.json({ message: "No active campaigns" });
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const campaign of campaigns) {
    log("INFO", "Processing campaign", {
      campaignId: campaign.id,
      campaignName: campaign.name,
      pendingInBatch: campaign.recipients.length,
    });

    if (campaign.recipients.length === 0) {
      log("INFO", "Campaign has no pending recipients — marking completed", { campaignId: campaign.id });
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
      continue;
    }

    // Get SMTP config for this campaign's owner
    const smtpConfig = await prisma.smtpConfig.findUnique({
      where: { userEmail: campaign.userEmail },
    });
    if (!smtpConfig || !smtpConfig.appPassword) {
      log("ERROR", "SMTP config missing or incomplete — skipping campaign", {
        campaignId: campaign.id,
        userEmail: campaign.userEmail,
        hasConfig: !!smtpConfig,
        hasPassword: !!smtpConfig?.appPassword,
      });
      continue;
    }
    log("INFO", "SMTP config loaded", {
      campaignId: campaign.id,
      smtpHost: smtpConfig.smtpHost,
      smtpPort: smtpConfig.smtpPort,
      smtpUser: smtpConfig.userEmail,
    });

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort,
      secure: false,
      auth: { user: smtpConfig.userEmail, pass: smtpConfig.appPassword },
    });

    // Verify SMTP connection before sending the batch
    try {
      await transporter.verify();
      log("INFO", "SMTP connection verified", { campaignId: campaign.id });
    } catch (e: unknown) {
      log("ERROR", "SMTP connection failed — skipping campaign", {
        campaignId: campaign.id,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    // Build PDF attachment from DB (base64) — works in serverless, no filesystem
    let attachments: nodemailer.SendMailOptions["attachments"] = [];
    if (campaign.template.pdfData) {
      const buffer = Buffer.from(campaign.template.pdfData, "base64");
      const filename = campaign.template.pdfPath
        ? path.basename(campaign.template.pdfPath)
        : "attachment.pdf";
      attachments = [{ filename, content: buffer }];
      log("INFO", "PDF attachment loaded", { campaignId: campaign.id, filename, sizeBytes: buffer.length });
    }

    for (let i = 0; i < campaign.recipients.length; i++) {
      const recipient = campaign.recipients[i];

      const subject = campaign.template.subject.replace(
        /\{\{company_name\}\}/g,
        recipient.companyName
      );
      const html = campaign.template.body.replace(
        /\{\{company_name\}\}/g,
        recipient.companyName
      );
      const text = htmlToText(html);

      log("INFO", "Sending email", {
        campaignId: campaign.id,
        recipientId: recipient.id,
        to: recipient.email,
        company: recipient.companyName,
        subject,
        batchIndex: `${i + 1}/${campaign.recipients.length}`,
      });

      const sendStart = Date.now();
      try {
        await transporter.sendMail({
          from: smtpConfig.userEmail,
          to: recipient.email,
          subject,
          html,
          text,
          attachments,
        });

        const elapsed = Date.now() - sendStart;
        log("INFO", "Email sent successfully", {
          campaignId: campaign.id,
          recipientId: recipient.id,
          to: recipient.email,
          elapsedMs: elapsed,
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
      } catch (e: unknown) {
        const elapsed = Date.now() - sendStart;
        const message = e instanceof Error ? e.message : "Unknown error";
        log("ERROR", "Email send failed", {
          campaignId: campaign.id,
          recipientId: recipient.id,
          to: recipient.email,
          error: message,
          elapsedMs: elapsed,
        });

        totalFailed++;
        await prisma.campaignEmail.update({
          where: { id: recipient.id },
          data: { status: "failed", error: message },
        });
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        });
      }

      // Pace emails within the batch — skip delay after the last one
      if (i < campaign.recipients.length - 1) {
        log("INFO", "Waiting before next email", { delayMs: EMAIL_DELAY_MS });
        await sleep(EMAIL_DELAY_MS);
      }
    }

    const remaining = await prisma.campaignEmail.count({
      where: { campaignId: campaign.id, status: "pending" },
    });
    log("INFO", "Batch done for campaign", {
      campaignId: campaign.id,
      remainingAfterBatch: remaining,
    });

    if (remaining === 0) {
      log("INFO", "Campaign completed — all emails processed", { campaignId: campaign.id });
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
    }
  }

  const totalElapsed = Date.now() - invocationStart;
  log("INFO", "Cron invocation finished", {
    totalSent,
    totalFailed,
    elapsedMs: totalElapsed,
  });

  return NextResponse.json({
    processed: true,
    sent: totalSent,
    failed: totalFailed,
  });
}
