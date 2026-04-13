import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="text-center space-y-4 !p-6">
          <ShieldAlert className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Accès non autorisé</h1>
          <p className="text-sm text-on-surface-variant">
            Votre compte n&apos;a pas les permissions nécessaires pour accéder à cette ressource.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button className="w-full">Aller à la connexion étudiant</Button>
            </Link>
            <Link href="/admin/login">
              <Button variant="secondary" className="w-full">Aller à la connexion admin</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
