"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  subject: string;
  pdfPath: string | null;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = () => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Template deleted");
      fetchTemplates();
    } else {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Link href="/templates/new">
          <Button>New Template</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No templates yet. Create your first email template.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Subject: {t.subject}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {t.pdfPath && <Badge variant="secondary">PDF</Badge>}
                    <Link href={`/templates/${t.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(t.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
