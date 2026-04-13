import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AppToastProvider } from "@/components/ui/use-toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#fcf9f8",
};

export const metadata: Metadata = {
  title: "Mizan — ميزان",
  description: "L'agent IA de bien-être étudiant. Votre espace de sérénité numérique.",
  manifest: "/manifest.json",
  applicationName: "Mizan",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mizan",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen overscroll-none" suppressHydrationWarning>
        <AuthProvider>
          <AppToastProvider>
            {/* Mobile Only Wrapper */}
            <div className="md:hidden flex min-h-[100dvh] flex-col">
              {children}
            </div>
            
            {/* Desktop Fallback Warning */}
            <div className="hidden md:flex min-h-screen w-full items-center justify-center bg-surface p-6">
              <div className="max-w-md text-center space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-surface-container-lowest shadow-sanctuary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/MIZAN_ICON.png" alt="Mizan Logo" className="w-14 h-14" />
                </div>
                <h1 className="text-3xl font-bold text-on-surface">Application Mobile</h1>
                <p className="text-on-surface-variant text-lg">
                  Mizan est une expérience conçue exclusivement pour les appareils mobiles. Veuillez y accéder depuis votre smartphone.
                </p>
              </div>
            </div>
          </AppToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
