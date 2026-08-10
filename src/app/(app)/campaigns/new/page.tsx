"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
}

interface Row {
  email: string;
  company_name: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [inputMode, setInputMode] = useState<"excel" | "manual">("excel");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Row[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [manualRows, setManualRows] = useState<Row[]>([
    { email: "", company_name: "" },
  ]);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Row>(sheet);
      const valid = rows.filter(
        (r) => r.email && r.company_name && r.email.includes("@")
      );
      setTotalRows(valid.length);
      setPreview(valid.slice(0, 5));
    };
    reader.readAsArrayBuffer(f);
  };

  const addManualRow = () => {
    setManualRows([...manualRows, { email: "", company_name: "" }]);
  };

  const removeManualRow = (index: number) => {
    if (manualRows.length === 1) return;
    setManualRows(manualRows.filter((_, i) => i !== index));
  };

  const updateManualRow = (
    index: number,
    field: "email" | "company_name",
    value: string
  ) => {
    const updated = [...manualRows];
    updated[index][field] = value;
    setManualRows(updated);
  };

  const getValidManualRows = () =>
    manualRows.filter((r) => r.email.includes("@") && r.company_name.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }

    if (inputMode === "excel" && !file) {
      toast.error("Please upload an Excel file");
      return;
    }

    if (inputMode === "manual" && getValidManualRows().length === 0) {
      toast.error("Add at least one valid recipient (email + company name)");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("templateId", templateId);
    if (!sendNow && scheduledAt) {
      formData.append("scheduledAt", scheduledAt);
    }

    if (inputMode === "excel" && file) {
      formData.append("file", file);
    } else {
      formData.append(
        "manualRecipients",
        JSON.stringify(getValidManualRows())
      );
    }

    const res = await fetch("/api/campaigns", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to create campaign");
      setLoading(false);
      return;
    }

    const campaign = await res.json();

    if (sendNow) {
      toast.info("Campaign created! Starting to send...");
      fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      router.push(`/campaigns/${campaign.id}`);
    } else {
      toast.success("Campaign scheduled!");
      router.push(`/campaigns/${campaign.id}`);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Campaign</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., August Outreach Batch 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No templates. Create one first.
                  </p>
                )}
              </div>

              {/* Input Mode Toggle */}
              <div className="space-y-2">
                <Label>Add Recipients</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode("excel")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium border transition-colors ${
                      inputMode === "excel"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent"
                    }`}
                  >
                    Upload Excel / CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("manual")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium border transition-colors ${
                      inputMode === "manual"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input hover:bg-accent"
                    }`}
                  >
                    Enter Manually
                  </button>
                </div>
              </div>

              {/* Excel Upload */}
              {inputMode === "excel" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Excel (.xlsx) or CSV — Column 1: <code>email</code> | Column 2:{" "}
                    <code>company_name</code>
                  </p>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Manual Entry */}
              {inputMode === "manual" && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Each email is sent individually (no CC/BCC). 10 second gap
                    between each.
                  </p>
                  {manualRows.map((row, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          type="email"
                          placeholder="hr@company.com"
                          value={row.email}
                          onChange={(e) =>
                            updateManualRow(i, "email", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Company Name"
                          value={row.company_name}
                          onChange={(e) =>
                            updateManualRow(i, "company_name", e.target.value)
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeManualRow(i)}
                        className="text-red-500 hover:text-red-700 px-2 py-2 text-lg leading-none"
                        title="Remove"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addManualRow}
                  >
                    + Add Row
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label>When to send</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={sendNow}
                      onChange={() => setSendNow(true)}
                    />
                    Send Now
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!sendNow}
                      onChange={() => setSendNow(false)}
                    />
                    Schedule
                  </label>
                </div>
                {!sendNow && (
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required={!sendNow}
                  />
                )}
              </div>

              <Button type="submit" disabled={loading}>
                {loading
                  ? "Creating..."
                  : sendNow
                  ? "Create & Send Now"
                  : "Create & Schedule"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              {inputMode === "excel" ? "File Preview" : "Recipients Preview"}
            </CardTitle>
            {inputMode === "excel" && totalRows > 0 && (
              <p className="text-sm text-gray-500">
                {totalRows} valid recipients found
              </p>
            )}
            {inputMode === "manual" && (
              <p className="text-sm text-gray-500">
                {getValidManualRows().length} valid recipients
              </p>
            )}
          </CardHeader>
          <CardContent>
            {inputMode === "excel" && preview.length === 0 && (
              <p className="text-gray-400 text-sm">
                Upload an Excel or CSV file to see a preview
              </p>
            )}

            {inputMode === "manual" && getValidManualRows().length === 0 && (
              <p className="text-gray-400 text-sm">
                Fill in at least one email + company name
              </p>
            )}

            {((inputMode === "excel" && preview.length > 0) ||
              (inputMode === "manual" && getValidManualRows().length > 0)) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Email</th>
                      <th className="pb-2 text-left">Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inputMode === "excel"
                      ? preview
                      : getValidManualRows()
                    ).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{i + 1}</td>
                        <td className="py-2">{r.email}</td>
                        <td className="py-2">{r.company_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inputMode === "excel" && totalRows > 5 && (
                  <p className="text-sm text-gray-400 mt-2">
                    ...and {totalRows - 5} more
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-green-50 rounded-lg text-xs text-green-800">
              Each email is sent <strong>individually</strong> (separate TO
              field, no CC/BCC) with a <strong>10 second delay</strong> between
              each send.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
