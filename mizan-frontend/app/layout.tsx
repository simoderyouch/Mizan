import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AppToastProvider } from "@/components/ui/use-toast";

export const metadata: Metadata = {
  title: "Mizan — ميزان",
  description: "AI wellbeing agent for students. Your digital wellbeing space.",
  icons: {
    icon: "/MIZAN_ICON.png",
    shortcut: "/MIZAN_ICON.png",
    apple: "/MIZAN_ICON.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <AuthProvider>
          <AppToastProvider>{children}</AppToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
