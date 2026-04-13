"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email = typeof window !== "undefined" ? sessionStorage.getItem("mizan_activation_email") : null;

  useEffect(() => {
    if (!email) router.push("/activate");
  }, [email, router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email: email ?? "", otp: code });
      sessionStorage.setItem("mizan_temp_token", res.temp_token);
      router.push("/activate/password");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Invalid code. Please try again."));
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

      <h2 className="text-2xl font-bold mb-1">Verification</h2>
      <p className="text-on-surface-variant text-sm mb-8">
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="space-y-2">
          <Label>Verification code</Label>
          <div className="flex gap-1.5 sm:gap-3 justify-center">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold input-sanctuary"
              />
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading || otp.join("").length !== 6}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               Verifying...
            </>
          ) : (
            "Verify code"
          )}
        </Button>
      </form>
    </div>
  );
}
