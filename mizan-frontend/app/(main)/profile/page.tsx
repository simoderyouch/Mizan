"use client";

import { useState } from "react";
import { GraduationCap, BookOpen, CalendarDays, Lock, LogOut, Loader2, Check, Shield } from "lucide-react";

import { ProfileDetailCard } from "@/components/profile/profile-detail-card";
import { ProfileHero } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authApi, filesApi, getApiErrorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/utils";

export default function ProfilePage() {
  const { student, logout, refreshStudent } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoRemoving, setPhotoRemoving] = useState(false);

  const memberSince = student?.created_at ? formatDateShort(student.created_at) : "—";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, "Error."));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);

    try {
      await filesApi.uploadMyPhoto(file);
      await refreshStudent();
      toast({
        title: "Photo updated",
        description: "Your profile photo has been saved.",
      });
    } catch (err: unknown) {
      toast({
        title: "Upload error",
        description: getApiErrorMessage(err, "Unable to upload the photo."),
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handlePhotoDelete = async () => {
    setPhotoRemoving(true);
    try {
      await filesApi.deleteMyPhoto();
      await refreshStudent();
      toast({
        title: "Photo deleted",
        description: "Your profile photo was deleted.",
      });
    } catch (err: unknown) {
      toast({
        title: "Delete error",
        description: getApiErrorMessage(err, "Unable to delete the photo."),
        variant: "destructive",
      });
    } finally {
      setPhotoRemoving(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-2xl space-y-6 px-1 pb-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Account</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">My profile</h1>
        <p className="text-sm text-on-surface-variant">
          Your photo, school details, and sign-in settings in one place.
        </p>
      </header>

      <ProfileHero
        student={student}
        photoUploading={photoUploading}
        photoRemoving={photoRemoving}
        onPhotoChange={(e) => void handlePhotoUpload(e)}
        onPhotoDelete={() => void handlePhotoDelete()}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ProfileDetailCard
          label="Class"
          value={student?.class_name || "—"}
          icon={GraduationCap}
        />
        <ProfileDetailCard
          label="Program"
          value={student?.filiere_name || "—"}
          icon={BookOpen}
        />
        <ProfileDetailCard
          label="Member since"
          value={memberSince}
          icon={CalendarDays}
          className="sm:col-span-2"
        />
      </div>

      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">Password</h3>
            <p className="text-xs text-on-surface-variant">Use at least 8 characters.</p>
          </div>
        </div>

        {passwordSuccess ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check className="h-4 w-4 shrink-0" />
            Password updated successfully.
          </div>
        ) : null}

        {passwordError ? (
          <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-700">
            {passwordError}
          </div>
        ) : null}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={passwordLoading} className="w-full sm:w-auto">
            {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-on-surface">Session</h3>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Sign out on this device. You can sign back in anytime with your credentials.
            </p>
            <Button variant="outline" onClick={logout} className="mt-4 w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
