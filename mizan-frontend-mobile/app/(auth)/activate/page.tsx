"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ActivatePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.requestActivation({ email });
      sessionStorage.setItem("mizan_activation_email", email);
      router.push("/activate/verify");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible d'envoyer le code. Vérifiez votre adresse e-mail."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sanctuary-card page-enter">
      <Link href="/login" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour
      </Link>

      <h2 className="text-2xl font-bold mb-1">Activer mon compte</h2>
      <p className="text-on-surface-variant text-sm mb-8">
        Entrez votre adresse e-mail académique pour recevoir un code d&apos;activation.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Adresse e-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/50" />
            <Input
              id="email"
              type="email"
              placeholder="votre.email@ecole.ma"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            "Recevoir le code"
          )}
        </Button>
      </form>
    </div>
  );
}
