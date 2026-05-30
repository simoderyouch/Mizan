"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProfileHeroProps = {
  student: Student | null;
  photoUploading: boolean;
  photoRemoving: boolean;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoDelete: () => void;
};

export function ProfileHero({
  student,
  photoUploading,
  photoRemoving,
  onPhotoChange,
  onPhotoDelete,
}: ProfileHeroProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullName = student ? `${student.first_name} ${student.last_name}`.trim() : "—";
  const initials =
    `${student?.first_name?.[0] ?? ""}${student?.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  const busy = photoUploading || photoRemoving;

  const openFilePicker = () => {
    if (!busy) fileInputRef.current?.click();
  };

  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm overflow-hidden">
      <div className="h-20 sm:h-24 bg-gradient-to-r from-primary/12 via-primary/6 to-transparent" />
      <div className="px-5 sm:px-6 pb-6 -mt-12 sm:-mt-14">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={onPhotoChange}
          disabled={busy}
        />

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className={cn(
              "group relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-surface-container-lowest",
              "bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            )}
          >
            {student?.photo_url ? (
              <Image
                src={student.photo_url}
                alt=""
                width={112}
                height={112}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-2xl font-bold text-primary">{initials}</span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center">
              {photoUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </button>

          <div className="min-w-0 flex-1 pt-1 sm:pb-1">
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">{fullName}</h2>
            {student?.email ? (
              <p className="text-sm text-on-surface-variant mt-0.5 truncate">{student.email}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface">
                CNE {student?.cne ?? "—"}
              </span>
              {student?.phone ? (
                <span className="inline-flex items-center rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                  {student.phone}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={openFilePicker} disabled={busy}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Change photo
          </Button>
          {student?.photo_url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-on-surface-variant hover:text-red-600"
              onClick={onPhotoDelete}
              disabled={busy}
            >
              {photoRemoving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Remove photo
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-on-surface-variant mt-3">JPG or PNG, max 2 MB.</p>
      </div>
    </section>
  );
}
