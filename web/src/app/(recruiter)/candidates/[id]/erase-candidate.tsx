"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eraseCandidateData } from "./actions";

export function EraseCandidate({ applicationId, reference, requested }: { applicationId: string; reference: string; requested: boolean }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={requested ? "destructive" : "outline"} className="w-full">
          <Trash2Icon /> Erase candidate data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase this candidate permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the candidate, all their applications, documents, notes, scores and emails. It cannot be undone. Only a record that an erasure happened is kept. Use it for
            deletion requests under the Data Protection Act.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex flex-col gap-2 text-sm">
          Type <span className="font-mono font-semibold">{reference}</span> to confirm
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending || typed.trim().toUpperCase() !== reference}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await eraseCandidateData({ applicationId, confirmReference: typed });
                if (r && !r.ok) setError(r.error);
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />} Erase permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
