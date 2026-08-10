"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import RichTextEditor from "@/components/rich-text-editor";

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorMode, setEditorMode] = useState<"richtext" | "html">("html");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("subject", subject);
    formData.append("body", body);
    if (label) formData.append("label", label);
    if (pdf) formData.append("pdf", pdf);

    const res = await fetch("/api/templates", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      toast.success("Template created!");
      router.push("/templates");
    } else {
      toast.error("Failed to create template");
    }
    setLoading(false);
  };

  const previewBody = body.replace(
    /\{\{company_name\}\}/g,
    '<span style="background:#fef08a;padding:0 4px;border-radius:3px">Acme Corp</span>'
  );
  const previewSubject = subject.replace(
    /\{\{company_name\}\}/g,
    "Acme Corp"
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Template</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <p className="text-sm text-gray-500">
              Use <code className="bg-gray-100 px-1 rounded">{"{{company_name}}"}</code>{" "}
              as a placeholder in subject and body.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Job Application"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Application for SDE role at {{company_name}}"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email Body</Label>
                  <div className="flex gap-1 border rounded-md p-0.5 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setEditorMode("richtext")}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        editorMode === "richtext"
                          ? "bg-white shadow-sm font-medium"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Rich Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("html")}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        editorMode === "html"
                          ? "bg-white shadow-sm font-medium"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      HTML Code
                    </button>
                  </div>
                </div>
                {editorMode === "richtext" ? (
                  <>
                    <p className="text-xs text-gray-500">
                      Use the toolbar to format text. Type <code className="bg-gray-100 px-1 rounded">{"{{company_name}}"}</code> where you want the company name inserted.
                    </p>
                    <RichTextEditor value={body} onChange={setBody} />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">
                      Paste your full HTML email template. Use <code className="bg-gray-100 px-1 rounded">{"{{company_name}}"}</code> as placeholder.
                    </p>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="<!DOCTYPE html>..."
                      className="font-mono text-sm min-h-[350px]"
                    />
                  </>
                )}
              </div>
              {/* TODO: Gmail Label — disabled for now, re-enable in future */}
              <div className="space-y-2">
                <Label htmlFor="pdf">PDF Attachment (optional)</Label>
                <Input
                  id="pdf"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdf(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Template"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <p className="text-sm text-gray-500">
              Shows how the email will look (with &quot;Acme Corp&quot; as sample)
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg bg-white">
              <div className="p-4 border-b">
                <p className="text-sm text-gray-500 mb-1">Subject:</p>
                <p className="font-medium">{previewSubject || "—"}</p>
              </div>
              {editorMode === "html" && body.includes("<html") ? (
                <iframe
                  srcDoc={previewBody}
                  className="w-full min-h-[400px] border-0"
                  sandbox=""
                  title="Email preview"
                />
              ) : (
                <div
                  className="prose prose-sm max-w-none p-4 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: previewBody || "—" }}
                />
              )}
            </div>
            {pdf && (
              <p className="text-sm text-gray-500 mt-3">
                Attachment: {pdf.name} ({(pdf.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
