"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefillEmail = new URLSearchParams(window.location.search).get("email");
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await authApi.login({ email, password });
      localStorage.setItem("mizan_access_token", tokens.access_token);
      localStorage.setItem("mizan_refresh_token", tokens.refresh_token);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Incorrect email or password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <Image
          src="/MIZAN_FULL_LOGO.png"
          alt="Mizan"
          width={220}
          height={72}
          priority
          className="mx-auto h-auto w-[100px] sm:w-[120px] mb-2"
        />
        <p className="text-on-surface-variant text-sm">Administration panel</p>
      </div>

      <div className="sanctuary-card w-full max-w-md page-enter">
        <h2 className="text-2xl font-bold mb-6">Admin sign in</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <p className="text-sm text-on-surface-variant mt-4 text-center">
          School administrator?{" "}
          <Link href="/admin/register" className="text-primary font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
