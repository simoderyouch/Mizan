"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, RotateCcw, UploadCloud } from "lucide-react";

import api, { getApiErrorMessage } from "@/lib/api";
import type { ApiMessageResponse } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

type ImportKey = "trombi" | "schedules" | "exams" | "projects";

interface ImportCardConfig {
  key: ImportKey;
  title: string;
  subtitle: string;
  replaceSupported: boolean;
}

interface ImportStatus {
  loading: boolean;
  progress: number;
  successMessage: string;
  errorMessage: string;
}

const IMPORT_CARDS: ImportCardConfig[] = [
  {
    key: "trombi",
    title: "Trombi import",
    subtitle: "CSV columns: nom,prenom,email,telephone,cne,photo_url",
    replaceSupported: false,
  },
  {
    key: "schedules",
    title: "Schedules import",
    subtitle: "CSV columns: subject,day_of_week,start_time,end_time,room,professor",
    replaceSupported: true,
  },
  {
    key: "exams",
    title: "Exams import",
    subtitle: "CSV columns: subject,exam_date,start_time,end_time,room",
    replaceSupported: true,
  },
  {
    key: "projects",
    title: "Projects import",
    subtitle: "CSV columns: name,subject,due_date,members",
    replaceSupported: true,
  },
];

const EMPTY_STATUS: ImportStatus = {
  loading: false,
  progress: 0,
  successMessage: "",
  errorMessage: "",
};

const resolveImportPath = (key: ImportKey, classId: string, replaceExisting: boolean) => {
  if (key === "trombi") return `/students/import/trombi/${classId}`;
  if (key === "schedules") return `/class-content/${classId}/schedules/import?replace_existing=${replaceExisting}`;
  if (key === "exams") return `/class-content/${classId}/exams/import?replace_existing=${replaceExisting}`;
  return `/class-content/${classId}/projects/import?replace_existing=${replaceExisting}`;
};

export default function ClassImportPage() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const { toast } = useToast();

  const [replaceExisting, setReplaceExisting] = useState<Record<ImportKey, boolean>>({
    trombi: false,
    schedules: false,
    exams: false,
    projects: false,
  });

  const [statusByImport, setStatusByImport] = useState<Record<ImportKey, ImportStatus>>({
    trombi: { ...EMPTY_STATUS },
    schedules: { ...EMPTY_STATUS },
    exams: { ...EMPTY_STATUS },
    projects: { ...EMPTY_STATUS },
  });

  const [retryPayload, setRetryPayload] = useState<{
    key: ImportKey;
    file: File;
    replace: boolean;
  } | null>(null);

  const anyLoading = useMemo(
    () => Object.values(statusByImport).some((status) => status.loading),
    [statusByImport]
  );

  const updateStatus = (key: ImportKey, next: Partial<ImportStatus>) => {
    setStatusByImport((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...next },
    }));
  };

  const resetStatusMessages = (key: ImportKey) => {
    updateStatus(key, {
      successMessage: "",
      errorMessage: "",
      progress: 0,
    });
  };

  const handleImport = async (key: ImportKey, file: File) => {
    if (!classId) {
      toast({ title: "Missing class ID", description: "Unable to resolve target class.", variant: "destructive" });
      return;
    }

    const shouldReplace = replaceExisting[key];
    resetStatusMessages(key);
    updateStatus(key, { loading: true });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<ApiMessageResponse>(resolveImportPath(key, classId, shouldReplace), formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          updateStatus(key, { progress: Math.round((event.loaded / event.total) * 100) });
        },
      });
      const message = response.data.message || "Import completed successfully.";

      updateStatus(key, { loading: false, progress: 100, successMessage: message, errorMessage: "" });
      setRetryPayload(null);
      toast({ title: "Import successful", description: message });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, `Import failed for ${key}.`);
      updateStatus(key, { loading: false, errorMessage: message, successMessage: "", progress: 0 });
      setRetryPayload({ key, file, replace: shouldReplace });
      toast({ title: "Import failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/classes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to classes
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Class import center</h1>
          <p className="mt-1 text-sm text-slate-500">Upload class CSV files with progress, replacement control, and retry workflows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/classes/${classId}/content`}>
            <Button variant="secondary">Manage class content</Button>
          </Link>
          <Link href={`/admin/classes/${classId}/students`}>
            <Button variant="secondary">View students</Button>
          </Link>
        </div>
      </div>

      {retryPayload && !anyLoading ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/70">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 !p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Last import failed</p>
                <p className="text-sm text-amber-700">
                  Retry {retryPayload.key} import with the previous file.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setReplaceExisting((prev) => ({ ...prev, [retryPayload.key]: retryPayload.replace }));
                void handleImport(retryPayload.key, retryPayload.file);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {IMPORT_CARDS.map((card) => {
          const status = statusByImport[card.key];
          const replaceEnabled = replaceExisting[card.key];
          return (
            <Card key={card.key} className="rounded-2xl border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs text-slate-500">{card.subtitle}</CardDescription>
                  </div>
                  {status.successMessage ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Imported
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {card.replaceSupported ? (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <Label htmlFor={`${card.key}-replace`} className="text-sm font-medium text-slate-700">
                        Replace existing entries
                      </Label>
                      <p className="text-xs text-slate-500">If enabled, previous class content is replaced during import.</p>
                    </div>
                    <Switch
                      id={`${card.key}-replace`}
                      checked={replaceEnabled}
                      onCheckedChange={(checked) => setReplaceExisting((prev) => ({ ...prev, [card.key]: checked }))}
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`${card.key}-file`}>CSV file</Label>
                  <input
                    id={`${card.key}-file`}
                    type="file"
                    accept=".csv"
                    disabled={status.loading || anyLoading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void handleImport(card.key, file);
                      event.currentTarget.value = "";
                    }}
                    className="block w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef0ff] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#4f56e6]"
                  />
                </div>

                {status.loading ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Uploading…</span>
                      <span>{status.progress}%</span>
                    </div>
                    <Progress value={status.progress} />
                  </div>
                ) : null}

                {status.errorMessage ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{status.errorMessage}</div>
                ) : null}

                {status.successMessage ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
                    {status.successMessage}
                  </div>
                ) : null}

                <div className="inline-flex items-center text-xs text-slate-500">
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                  Select a file to start upload
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
