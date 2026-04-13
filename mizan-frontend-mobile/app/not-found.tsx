import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="text-center page-enter">
        <h1 className="text-8xl font-bold text-primary/20 mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-2">Page introuvable</h2>
        <p className="text-on-surface-variant mb-8 max-w-sm">
          Cette page n&apos;existe pas ou a été déplacée. Retournez à votre sanctuaire.
        </p>
        <Link href="/dashboard">
          <Button>Retour à l&apos;accueil</Button>
        </Link>
      </div>
    </div>
  );
}
