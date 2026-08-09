import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const userEmail = session.user.email;

  let campaignCount = 0;
  let sent = 0;
  let failed = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentCampaigns: any[] = [];
  let smtpConfigured = false;

  try {
    const [count, totals, campaigns, smtpConfig] = await Promise.all([
      prisma.campaign.count({ where: { userEmail } }),
      prisma.campaign.aggregate({
        where: { userEmail },
        _sum: { sentCount: true, failedCount: true },
      }),
      prisma.campaign.findMany({
        where: { userEmail },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { template: { select: { name: true } } },
      }),
      prisma.smtpConfig.findUnique({ where: { userEmail } }),
    ]);

    campaignCount = count;
    sent = totals._sum.sentCount || 0;
    failed = totals._sum.failedCount || 0;
    recentCampaigns = campaigns;
    smtpConfigured = !!(smtpConfig && smtpConfig.appPassword);
  } catch (e) {
    console.error("Dashboard query error:", e);
  }

  const successRate = sent + failed > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : "0";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {!smtpConfigured && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-medium">SMTP not configured</p>
          <p className="text-yellow-700 text-sm mt-1">
            You need to set up your Gmail App Password before you can send emails.{" "}
            <Link href="/settings" className="text-blue-600 hover:underline font-medium">
              Go to Settings
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaignCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Emails Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{successRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No campaigns yet.{" "}
              <Link href="/campaigns/new" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Template</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Sent / Total</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2">{c.template.name}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          c.status === "completed"
                            ? "default"
                            : c.status === "sending"
                            ? "secondary"
                            : c.status === "failed"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {c.sentCount} / {c.totalEmails}
                    </td>
                    <td className="py-2">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
