"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import RichTextEditor from "@/components/rich-text-editor";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [existingPdf, setExistingPdf] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editorMode, setEditorMode] = useState<"richtext" | "html">("html");

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name);
        setSubject(data.subject);
        setBody(data.body);
        setLabel(data.label || "");
        setExistingPdf(data.pdfPath);
        // Auto-detect mode: if body has full HTML structure, use HTML mode
        if (data.body && data.body.includes("<!DOCTYPE") || data.body.includes("<html")) {
          setEditorMode("html");
        }
        setFetching(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("subject", subject);
    formData.append("body", body);
    if (label) formData.append("label", label);
    if (pdf) formData.append("pdf", pdf);

    const res = await fetch(`/api/templates/${id}`, {
      method: "PUT",
      body: formData,
    });

    if (res.ok) {
      toast.success("Template updated!");
      router.push("/templates");
    } else {
      toast.error("Failed to update template");
    }
    setLoading(false);
  };

  if (fetching) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Template</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <p className="text-sm text-gray-500">
            Use <code className="bg-gray-100 px-1 rounded">{"{{company_name}}"}</code>{" "}
            as a placeholder.
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
                <RichTextEditor value={body} onChange={setBody} />
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
              <Label htmlFor="pdf">
                PDF Attachment{" "}
                {existingPdf && (
                  <span className="text-gray-400">(current: {existingPdf.split("/").pop()})</span>
                )}
              </Label>
              <Input
                id="pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/templates")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
