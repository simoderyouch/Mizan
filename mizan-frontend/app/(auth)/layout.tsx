import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-8">
      {/* Mizan Branding */}
      <div className="text-center mb-8">
        <Image
          src="/MIZAN_FULL_LOGO.png"
          alt="Mizan"
          width={220}
          height={72}
          priority
          className="mx-auto h-auto w-[100px] sm:w-[120px] mb-1"
        />
        <p className="text-on-surface-variant text-sm">Your digital wellbeing space</p>
      </div>

      {/* Auth Content */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Security Badge */}
      <div className="mt-8 flex items-center gap-2 text-xs text-on-surface-variant/60">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="uppercase tracking-widest font-semibold">Secure system</span>
      </div>
    </div>
  );
}
