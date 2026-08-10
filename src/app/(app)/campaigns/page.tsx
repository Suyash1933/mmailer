"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 30_000; // trigger send + refresh every 30s while sending

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalEmails: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  template: { name: string };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaigns = async () => {
    const r = await fetch("/api/campaigns");
    const data = await r.json();
    setCampaigns(data);
    setLoading(false);
    return data as Campaign[];
  };

  const triggerSend = async () => {
    await fetch("/api/cron/send-emails");
  };

  const tick = async () => {
    await triggerSend();
    const data = await fetchCampaigns();
    const stillSending = data.some((c) => c.status === "sending");
    if (!stillSending) {
      stopPolling();
    }
  };

  const startPolling = () => {
    if (intervalRef.current) return;
    setPolling(true);
    tick(); // fire immediately
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
  };

  // Start polling automatically if any campaign is sending on mount
  useEffect(() => {
    fetchCampaigns().then((data) => {
      if (data.some((c) => c.status === "sending")) {
        startPolling();
      }
    });
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Campaign deleted");
      fetchCampaigns();
    } else {
      toast.error("Failed to delete");
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed": return "default" as const;
      case "sending": return "secondary" as const;
      case "failed": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <div className="flex items-center gap-3">
          {polling && (
            <span className="text-xs text-green-600 animate-pulse">
              ● Sending in progress…
            </span>
          )}
          <Link href="/campaigns/new">
            <Button>New Campaign</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No campaigns yet. Create your first campaign.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Template</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Progress</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3">{c.template.name}</td>
                  <td className="py-3">
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="py-3">
                    {c.sentCount}/{c.totalEmails} sent
                    {c.failedCount > 0 && (
                      <span className="text-red-500 ml-1">
                        ({c.failedCount} failed)
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
