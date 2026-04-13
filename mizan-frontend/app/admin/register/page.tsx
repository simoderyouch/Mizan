"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, Loader2, Lock, Mail, Phone, ShieldCheck, UserRoundCheck } from "lucide-react";

import { authApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function AdminRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [schoolName, setSchoolName] = useState("");
  const [officialIdentifier, setOfficialIdentifier] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedSchool = schoolName.trim();
    const trimmedEmail = adminEmail.trim();

    if (!trimmedSchool || !trimmedEmail || !adminPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (adminPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.registerSchool({
        name: trimmedSchool,
        official_identifier: officialIdentifier.trim(),
        contact_phone: contactPhone.trim(),
        admin_email: trimmedEmail,
        admin_password: adminPassword,
      });
      setIsSuccess(true);
      toast({
        title: "Registration submitted",
        description: "Your school registration is now pending review by Mizan Global.",
      });
    } catch (submitError: unknown) {
      setError(getApiErrorMessage(submitError, "Unable to create school admin account."));
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
        <div className="w-full max-w-md space-y-8 text-center page-enter">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-sanctuary">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-on-surface">Registration pending</h1>
            <p className="text-on-surface-variant">
              Your school <span className="font-semibold text-primary">{schoolName}</span> has been registered and is now under review.
            </p>
          </div>
          <div className="sanctuary-card !bg-surface-container-low p-6 text-left">
            <div className="flex gap-4">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Verification process</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  A Mizan Global Admin will verify your institutional credentials. This usually takes 24-48 hours. You will receive an email once your account is activated.
                </p>
              </div>
            </div>
          </div>
          <Button asChild className="w-full" variant="secondary">
            <Link href="/admin/login">Return to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link href="/admin/login" className="mb-6 inline-flex items-center text-sm text-on-surface-variant hover:text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to admin login
        </Link>

        <div className="mb-6 text-center">
          <Image
            src="/MIZAN_FULL_LOGO.png"
            alt="Mizan"
            width={220}
            height={72}
            priority
            className="mx-auto mb-2 h-auto w-[120px]"
          />
          <h1 className="text-2xl font-bold">Register school head</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Create your school and admin account in one step.
          </p>
        </div>

        <div className="sanctuary-card page-enter">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="school-name">School name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                  <Input
                    id="school-name"
                    value={schoolName}
                    onChange={(event) => setSchoolName(event.target.value)}
                    className="pl-10"
                    placeholder="Mizan Academy"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="official-id">Institutional ID</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                  <Input
                    id="official-id"
                    value={officialIdentifier}
                    onChange={(event) => setOfficialIdentifier(event.target.value)}
                    className="pl-10"
                    placeholder="Registry No."
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-phone">Official phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className="pl-10"
                  placeholder="+212 ..."
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  className="pl-10"
                  placeholder="head@school.ma"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm</Label>
                <div className="relative">
                  <UserRoundCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit registration
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
