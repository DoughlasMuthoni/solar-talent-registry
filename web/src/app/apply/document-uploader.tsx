"use client";

import { useRef, useState } from "react";
import { FileTextIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { supabaseBrowser } from "@/lib/auth/supabase-browser";
import { ACCEPT_ATTR, ALLOWED_TYPES, BUCKET, MAX_FILE_BYTES, MAX_FILES_PER_APPLICATION } from "@/lib/upload-config";
import { requestUploadUrl } from "./actions";

export type UploadItem = { path: string; kind: "EPRA_LICENCE" | "QUALIFICATION" | "CERTIFICATE"; fileName: string; size: number };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * Optional document upload. Files go straight from the phone to private storage via a one-time signed URL;
 * the server re-checks every file when the application is submitted.
 */
export function DocumentUploader({
  kind,
  label,
  description,
  submissionKey,
  items,
  onChange,
  max = 1,
}: {
  kind: UploadItem["kind"];
  label: string;
  description: string;
  submissionKey: string;
  items: UploadItem[];
  onChange: (next: UploadItem[]) => void;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = items.filter((i) => i.kind === kind);
  const full = mine.length >= max || items.length >= MAX_FILES_PER_APPLICATION;

  async function upload(file: File) {
    setError(null);
    if (!(file.type in ALLOWED_TYPES)) return setError("Choose a PDF, JPG, PNG or WebP file.");
    if (file.size > MAX_FILE_BYTES) return setError(`That file is ${mb(file.size)}. The limit is 5 MB — try a photo at lower quality or a PDF.`);
    setBusy(true);
    try {
      const res = await requestUploadUrl({ submissionKey, type: file.type, size: file.size });
      if (!res.ok) return setError(res.error);
      const { error: upErr } = await supabaseBrowser().storage.from(BUCKET).uploadToSignedUrl(res.path, res.token, file, { contentType: file.type });
      if (upErr) return setError("Upload failed. Check your connection and try again.");
      onChange([...items, { path: res.path, kind, fileName: file.name, size: file.size }]);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={`upload-${kind}`}>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      {mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((i) => (
            <li key={i.path} className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{i.fileName}</span>
              <span className="text-muted-foreground text-xs">{mb(i.size)}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${i.fileName}`} onClick={() => onChange(items.filter((x) => x.path !== i.path))}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        id={`upload-${kind}`}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        disabled={busy || full}
      />
      {!full && (
        <Button type="button" variant="outline" className="h-11 self-start" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} {busy ? "Uploading…" : mine.length ? "Add another" : "Choose file"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </Field>
  );
}
