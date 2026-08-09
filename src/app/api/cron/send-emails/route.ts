import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import nodemailer from "nodemailer";
import path from "path";
import { ImapFlow } from "imapflow";

export const maxDuration = 55; // Vercel function timeout (seconds)

const BATCH_SIZE = 10; // emails per cron invocation

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: Request) {
  // Allow access via cron secret OR authenticated user session
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const hasValidCronSecret = !cronSecret || authHeader === `Bearer ${cronSecret}`;

  if (!hasValidCronSecret) {
    // No valid cron secret — check for user session instead
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

  if (campaigns.length === 0) {
    return NextResponse.json({ message: "No active campaigns" });
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const campaign of campaigns) {
    if (campaign.recipients.length === 0) {
      // No more pending — mark campaign as completed
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
      // Skip this campaign — owner hasn't configured SMTP
      continue;
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort,
      secure: false,
      auth: { user: smtpConfig.userEmail, pass: smtpConfig.appPassword },
    });

    // Prepare PDF attachment if exists
    let attachments: nodemailer.SendMailOptions["attachments"] = [];
    if (campaign.template.pdfPath) {
      const fullPath = path.join(process.cwd(), campaign.template.pdfPath);
      attachments = [{ filename: path.basename(fullPath), path: fullPath }];
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

    let sentCount = campaign.sentCount;
    let failedCount = campaign.failedCount;

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

        sentCount++;
        totalSent++;
        await prisma.campaignEmail.update({
          where: { id: recipient.id },
          data: { status: "sent", sentAt: new Date() },
        });

        // Apply Gmail label via IMAP
        if (imapClient && gmailLabel && info.messageId) {
          try {
            await sleep(500);
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
        failedCount++;
        totalFailed++;
        const message = e instanceof Error ? e.message : "Unknown error";
        await prisma.campaignEmail.update({
          where: { id: recipient.id },
          data: { status: "failed", error: message },
        });
      }

      // Update campaign counts after each email
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { sentCount, failedCount },
      });

      // 1 second delay between emails to avoid rate limits
      if (campaign.recipients.indexOf(recipient) < campaign.recipients.length - 1) {
        await sleep(1000);
      }
    }

    // Close IMAP
    if (imapClient) {
      try {
        await imapClient.logout();
      } catch {
        // Ignore
      }
    }

    // Check if campaign is fully done
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
  });
}
