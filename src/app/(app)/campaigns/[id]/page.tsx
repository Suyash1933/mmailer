"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Recipient {
  id: string;
  email: string;
  companyName: string;
  status: string;
  error: string | null;
  sentAt: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  createdAt: string;
  template: { name: string; subject: string };
  recipients: Recipient[];
}

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sending, setSending] = useState(false);

  const fetchCampaign = useCallback(() => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then(setCampaign);
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Poll for status updates while sending
  const campaignStatus = campaign?.status;
  useEffect(() => {
    if (campaignStatus !== "sending") return;

    const interval = setInterval(() => {
      fetch(`/api/campaigns/${id}/status`)
        .then((r) => r.json())
        .then((data) => {
          setCampaign((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status,
                  sentCount: data.sentCount,
                  failedCount: data.failedCount,
                }
              : prev
          );
          if (data.status !== "sending") {
            clearInterval(interval);
            fetchCampaign(); // Full refresh to get updated recipients
          }
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [campaignStatus, id, fetchCampaign]);

  const handleSend = async () => {
    setSending(true);
    const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      toast.success("Sending started!");
      fetchCampaign();
    } else {
      toast.error(data.error || "Failed to start sending");
    }
    setSending(false);
  };

  if (!campaign) return <p className="text-gray-500">Loading...</p>;

  const progress =
    campaign.totalEmails > 0
      ? ((campaign.sentCount + campaign.failedCount) / campaign.totalEmails) * 100
      : 0;

  const pendingCount =
    campaign.totalEmails - campaign.sentCount - campaign.failedCount;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-gray-500 text-sm">
            Template: {campaign.template.name} | Created:{" "}
            {new Date(campaign.createdAt).toLocaleString()}
          </p>
        </div>
        {(campaign.status === "draft" || pendingCount > 0) &&
          campaign.status !== "sending" && (
            <Button onClick={handleSend} disabled={sending}>
              {sending
                ? "Starting..."
                : pendingCount < campaign.totalEmails
                ? `Resume (${pendingCount} remaining)`
                : "Send Now"}
            </Button>
          )}
      </div>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex justify-between items-center mb-2">
            <Badge
              variant={
                campaign.status === "completed"
                  ? "default"
                  : campaign.status === "sending"
                  ? "secondary"
                  : campaign.status === "failed"
                  ? "destructive"
                  : "outline"
              }
            >
              {campaign.status}
            </Badge>
            <span className="text-sm text-gray-500">
              {campaign.sentCount} sent / {campaign.failedCount} failed /{" "}
              {campaign.totalEmails} total
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {campaign.scheduledAt && campaign.status === "draft" && (
            <p className="text-sm text-gray-500 mt-2">
              Scheduled for: {new Date(campaign.scheduledAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients ({campaign.recipients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Company</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Sent At</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {campaign.recipients.map((r, i) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{r.email}</td>
                    <td className="py-2">{r.companyName}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          r.status === "sent"
                            ? "default"
                            : r.status === "failed"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {r.sentAt
                        ? new Date(r.sentAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2 text-red-500 text-xs max-w-xs truncate">
                      {r.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
