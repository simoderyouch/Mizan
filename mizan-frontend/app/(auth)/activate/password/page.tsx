"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

export default function SetPasswordPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tempToken = typeof window !== "undefined" ? sessionStorage.getItem("mizan_temp_token") : null;

  useEffect(() => {
    if (!tempToken) router.push("/activate");
  }, [tempToken, router]);

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Passwords match", met: password === confirmPassword && password.length > 0 },
  ];

  const allMet = requirements.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.setPassword({
        token: tempToken ?? "",
        new_password: password,
      });
      setTokens(res);
      sessionStorage.removeItem("mizan_activation_email");
      sessionStorage.removeItem("mizan_temp_token");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error while creating password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sanctuary-card page-enter">
      <Link href="/activate" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <h2 className="text-2xl font-bold mb-1">Create your password</h2>
      <p className="text-on-surface-variant text-sm mb-8">
        Choose a secure password for your Mizan account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface-variant"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          {requirements.map((req, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                req.met ? "bg-emerald-100 text-emerald-600" : "bg-surface-container"
              }`}>
                {req.met && <Check className="h-3 w-3" />}
              </div>
              <span className={req.met ? "text-emerald-600" : "text-on-surface-variant"}>
                {req.label}
              </span>
            </div>
          ))}
        </div>

        <Button type="submit" className="w-full" disabled={loading || !allMet}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               Creating...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}
