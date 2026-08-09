"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [appPassword, setAppPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [loading, setLoading] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    fetch("/api/settings/smtp")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSmtpHost(data.smtpHost || "smtp.gmail.com");
          setSmtpPort(String(data.smtpPort || 587));
          setHasExisting(data.hasPassword || false);
        }
      });
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/settings/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appPassword,
        smtpHost,
        smtpPort: parseInt(smtpPort),
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      toast.success("SMTP settings saved and verified!");
      setHasExisting(true);
      setAppPassword("");
    } else {
      toast.error(data.error || "Failed to save settings");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <p className="text-sm text-gray-500">
            Your signed-in Gmail (<strong>{session?.user?.email}</strong>) is the
            sender. Each account has its own SMTP settings.
          </p>
          <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>How to get an App Password:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>
                Go to{" "}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Google Account &gt; Security
                </a>
              </li>
              <li>Enable 2-Step Verification (if not already)</li>
              <li>
                Search{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  &quot;App Passwords&quot;
                </a>{" "}
                in Google Account settings
              </li>
              <li>Create one for &quot;Mail&quot; — copy the 16-char password</li>
            </ol>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Sender Email</Label>
              <Input
                id="email"
                type="email"
                value={session?.user?.email || ""}
                disabled
                className="bg-gray-100"
              />
              <p className="text-xs text-gray-400">
                This is your Google sign-in email (read-only)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appPassword">
                App Password{" "}
                {hasExisting && (
                  <span className="text-green-600">(configured)</span>
                )}
              </Label>
              <Input
                id="appPassword"
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required={!hasExisting}
              />
              {hasExisting && (
                <p className="text-xs text-gray-400">
                  Leave blank to keep current password
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying & Saving..." : "Save & Verify Connection"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
