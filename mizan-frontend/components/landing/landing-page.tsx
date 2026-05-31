"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircle,
  Mic,
  Moon,
  School,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const STATS = [
  { label: "Daily rituals", value: "Morning & evening" },
  { label: "Companion", value: "Voice + chat agent" },
  { label: "Built for", value: "Students & schools" },
];

const PILLARS = [
  { icon: Moon, label: "Check-ins", detail: "Voice or QCM" },
  { icon: Bot, label: "AI agent", detail: "Chat & commitments" },
  { icon: LineChart, label: "Analytics", detail: "Student & admin" },
  { icon: Target, label: "Goals & tasks", detail: "Weekly rhythm" },
];

const STEPS = [
  {
    step: "01",
    title: "Check in with context",
    description: "Sleep, mood, and schedule-aware questions — by voice or QCM — in under two minutes.",
    icon: Moon,
  },
  {
    step: "02",
    title: "Receive a plan that adapts",
    description: "Mistral-powered analysis turns your answers into priorities, tasks, and gentle nudges.",
    icon: Sparkles,
  },
  {
    step: "03",
    title: "Track balance all week",
    description: "Goals, study modes, commitments, and analytics — for you and your institution.",
    icon: BarChart3,
  },
];

const CAPABILITIES = [
  {
    title: "Voice companion",
    description: "Morning and evening flows with TTS, transcription, and a calm spoken ritual.",
    icon: Mic,
  },
  {
    title: "Agent chat",
    description: "Text or voice conversations that understand your tasks, mood, and schedule.",
    icon: MessageCircle,
  },
  {
    title: "Study modes",
    description: "Revision, exam, and course modes with live timers on your dashboard.",
    icon: CalendarDays,
  },
  {
    title: "School console",
    description: "Filieres, classes, imports, and cohort wellbeing visibility for admins.",
    icon: School,
  },
];

const FEATURE_ROWS = [
  {
    title: "An agent that remembers your week",
    description:
      "Chat or talk with Mizan between check-ins. The agent sees your tasks, goals, and mood trend — then suggests realistic next steps, not generic advice.",
    bullets: ["Text & voice chat", "Adaptive commitments", "Task suggestions from conversation"],
    icon: Bot,
    mascot: "/mascot/mascot_focus.png",
  },
  {
    title: "Rituals that fit real student life",
    description:
      "Morning and evening flows designed for busy campuses — quick when you need speed, deeper when you have time.",
    bullets: ["Voice companion with TTS", "Evening reflection", "Burnout risk signals for admins"],
    icon: Mic,
    mascot: "/mascot/mascot_happy.png",
    reverse: true,
  },
];

const PRINCIPLES = [
  { icon: Shield, title: "Private by design", text: "JWT auth, role-based access, and school-scoped data." },
  { icon: Waves, title: "Calm by default", text: "Sanctuary UI — soft surfaces, no noise, room to breathe." },
  { icon: Heart, title: "Human-first AI", text: "Supportive tone, adaptive commitments, never punitive." },
];

const AUDIENCES = [
  {
    title: "For students",
    description: "A calm home base for sleep, stress, and study rhythm — not another noisy productivity app.",
    items: ["Personal dashboard & weekly report", "Wellbeing resource library", "Study modes & task board"],
    icon: GraduationCap,
    href: "/login",
    cta: "Student login",
  },
  {
    title: "For schools",
    description: "Institutional structure with filières, classes, and aggregated analytics — without losing individual care.",
    items: ["School admin console", "Student onboarding & schedules", "Trend visibility across cohorts"],
    icon: School,
    href: "/admin/login",
    cta: "Admin login",
  },
];

const GUEST_PORTALS = [
  { href: "/login", label: "Student login", hint: "Dashboard, check-ins, agent, goals.", icon: GraduationCap },
  { href: "/admin/login", label: "School admin", hint: "Classes, imports, analytics.", icon: School },
  { href: "/admin/register", label: "Register a school", hint: "Start institutional onboarding.", icon: Sparkles },
  { href: "/activate", label: "Activate account", hint: "Verify email & set password.", icon: ShieldCheck },
];

const QUICK_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checkin", label: "Check-in", icon: Moon },
  { href: "/agent/chat", label: "AI chat", icon: MessageCircle },
  { href: "/tasks", label: "Tasks", icon: Target },
  { href: "/goals", label: "Goals", icon: Heart },
  { href: "/modes", label: "Study modes", icon: CalendarDays },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-sanctuary mb-3 text-primary/80">{children}</p>;
}

function MascotFrame({ src, alt, size = "md" }: { src: string; alt: string; size?: "sm" | "md" | "lg" }) {
  const padding = size === "sm" ? "p-4" : size === "lg" ? "p-6 md:p-10" : "p-8";
  const imageMax = size === "sm" ? "max-w-[120px]" : size === "lg" ? "max-w-[320px] lg:max-w-[360px]" : "max-w-[240px]";
  const float = size === "lg" ? "animate-mascot-float" : "";
  return (
    <div className={`rounded-[2rem] border border-outline-variant/10 bg-white ${padding}`}>
      <Image src={src} alt={alt} width={400} height={400} className={`mx-auto h-auto w-full ${imageMax} ${float}`} />
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, student, logout } = useAuth();
  const firstName = student?.first_name?.trim() || "there";

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,92,174,0.08),transparent)]"
      />

      <header className="sticky top-0 z-20 border-b border-outline-variant/10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <Image src="/MIZAN_ICON.png" alt="Mizan" width={44} height={44} className="h-11 w-11 rounded-xl" />
            <div>
              <p className="text-lg font-extrabold tracking-tight text-on-surface">Mizan</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">ميزان · Balance</p>
            </div>
          </Link>

          {!isAuthenticated ? (
            <nav className="hidden items-center gap-6 text-sm font-semibold text-on-surface-variant md:flex">
              <a href="#how-it-works" className="transition-colors hover:text-primary">How it works</a>
              <a href="#features" className="transition-colors hover:text-primary">Features</a>
              <a href="#access" className="transition-colors hover:text-primary">Access</a>
            </nav>
          ) : null}

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-on-surface-variant lg:inline">
                  Welcome, <span className="font-bold text-on-surface">{firstName}</span>
                </span>
                <Button asChild size="sm" className="rounded-xl">
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={logout}>
                  <LogOut className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden rounded-xl sm:inline-flex">
                  <Link href="/admin/login">Admin</Link>
                </Button>
                <Button asChild size="sm" className="rounded-xl">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pb-12 pt-10 md:px-8 md:pt-14 lg:pb-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="page-enter space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-white px-4 py-1.5 text-xs font-bold text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {isAuthenticated ? "Your sanctuary is ready" : "Student wellbeing · AI-native"}
              </div>

              <div className="space-y-5">
                <h1 className="max-w-[14ch] text-4xl font-extrabold leading-[1.02] tracking-tight text-on-surface md:text-5xl lg:text-[3.35rem]">
                  {isAuthenticated ? (
                    <>
                      Balance starts with <span className="text-primary">you, {firstName}.</span>
                    </>
                  ) : (
                    <>
                      The digital sanctuary for <span className="text-primary">student balance.</span>
                    </>
                  )}
                </h1>
                <p className="max-w-[52ch] text-base leading-relaxed text-on-surface-variant md:text-lg">
                  {isAuthenticated
                    ? "Pick up where you left off — check-ins, your AI companion, and the dashboard are one click away."
                    : "Mizan (ميزان — “balance”) helps students manage stress, sleep, and study rhythm with daily rituals, a voice-aware agent, and dashboards schools can trust."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <>
                    <Button asChild size="lg" className="rounded-xl px-8">
                      <Link href="/dashboard">
                        Open dashboard
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="rounded-xl bg-white">
                      <Link href="/agent/chat">Talk to Mizan</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="rounded-xl px-8">
                      <Link href="/login">
                        Enter as student
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary" className="rounded-xl bg-white">
                      <Link href="/admin/register">Register a school</Link>
                    </Button>
                  </>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {STATS.map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-outline-variant/10 bg-white px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
                    <p className="mt-1 text-sm font-bold text-on-surface">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <MascotFrame src="/mascot/mascot_happy.png" alt="Mizan mascot" size="lg" />
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-4 py-3 text-center text-sm font-semibold text-on-surface">
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                Meet your wellbeing companion
              </div>
            </div>
          </div>
        </section>

        {/* Pillars strip */}
        <section className="border-y border-outline-variant/10 bg-white py-8">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 md:grid-cols-4 md:px-8">
            {PILLARS.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface px-4 py-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">{label}</p>
                  <p className="text-xs text-on-surface-variant">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Meaning */}
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="grid items-center gap-10 rounded-3xl border border-outline-variant/10 bg-white p-8 md:grid-cols-[1fr_auto] md:p-12">
              <div className="max-w-2xl">
                <SectionLabel>Why Mizan</SectionLabel>
                <h2 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
                  Balance is not a luxury — it is a practice.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
                  Named after the Arabic word for scale and equilibrium, Mizan gives students a daily rhythm:
                  check in honestly, receive guidance that fits, and track progress without guilt or noise.
                </p>
              </div>
              <p className="text-5xl font-extrabold text-primary/20 md:text-6xl" aria-hidden>
                ميزان
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-outline-variant/10 bg-surface-container-low/40 py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="max-w-2xl">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
                Three rhythms. One balanced week.
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map(({ step, title, description, icon: Icon }) => (
                <article
                  key={step}
                  className="rounded-2xl border border-outline-variant/10 bg-white p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <p className="text-4xl font-extrabold tracking-tighter text-primary/15">{step}</p>
                  <div className="mt-4 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-on-surface">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities bento */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <SectionLabel>Platform</SectionLabel>
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
              Everything a student day needs — in one calm place.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="flex gap-4 rounded-2xl border border-outline-variant/10 bg-white p-6 transition-colors hover:border-primary/20"
                >
                  <div className="h-fit rounded-xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Feature rows */}
        <section id="features" className="border-t border-outline-variant/10 bg-surface-container-low/30 py-16 md:py-24">
          <div className="mx-auto max-w-7xl space-y-20 px-4 md:px-8">
            {FEATURE_ROWS.map(({ title, description, bullets, icon: Icon, mascot, reverse }, index) => (
              <div
                key={title}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[direction:rtl]" : ""}`}
              >
                <div className={`${reverse ? "lg:[direction:ltr]" : ""} space-y-5`}>
                  <SectionLabel>Feature {index + 1}</SectionLabel>
                  <div className="inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">{title}</h2>
                  <p className="max-w-[52ch] text-base leading-relaxed text-on-surface-variant">{description}</p>
                  <ul className="space-y-2">
                    {bullets.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm font-medium text-on-surface">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${reverse ? "lg:[direction:ltr]" : ""} flex justify-center`}>
                  <MascotFrame src={mascot} alt="" size="md" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              {PRINCIPLES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-outline-variant/10 bg-white p-6 text-center md:text-left">
                  <div className="mx-auto inline-flex rounded-xl bg-primary/10 p-2.5 text-primary md:mx-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-on-surface">{title}</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {!isAuthenticated ? (
          <>
            <section className="border-y border-outline-variant/10 bg-white py-16 md:py-20">
              <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-12 max-w-2xl">
                  <SectionLabel>Who it&apos;s for</SectionLabel>
                  <h2 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
                    One platform, two perspectives.
                  </h2>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  {AUDIENCES.map(({ title, description, items, icon: Icon, href, cta }) => (
                    <article
                      key={title}
                      className="flex flex-col rounded-3xl border border-outline-variant/10 bg-surface p-8"
                    >
                      <div className="inline-flex w-fit rounded-xl bg-primary/10 p-3 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-5 text-2xl font-bold text-on-surface">{title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
                      <ul className="mt-6 space-y-2">
                        {items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-on-surface">
                            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button asChild className="mt-8 w-full rounded-xl sm:w-auto" variant="secondary">
                        <Link href={href}>
                          {cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="access" className="py-16 md:py-20">
              <div className="mx-auto max-w-7xl px-4 md:px-8">
                <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <SectionLabel>Get started</SectionLabel>
                    <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Choose your entry point</h2>
                    <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
                      Students, school admins, and new institutions each have a dedicated path.
                    </p>
                  </div>
                  <MascotFrame src="/mascot/mascot_focus.png" alt="" size="sm" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {GUEST_PORTALS.map(({ href, label, hint, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex items-start gap-4 rounded-2xl border border-outline-variant/10 bg-white p-5 transition-all duration-300 hover:border-primary/25 active:scale-[0.99]"
                    >
                      <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold text-on-surface">{label}</h3>
                          <ArrowRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                        <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8">
              <SectionLabel>Your space</SectionLabel>
              <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Quick links</h2>
              <p className="mt-2 text-sm text-on-surface-variant">Jump back into your wellbeing routine.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-4 rounded-2xl border border-outline-variant/10 bg-white p-5 transition-all hover:border-primary/20 active:scale-[0.99]"
                  >
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="flex-1 text-lg font-bold text-on-surface">{label}</span>
                    <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA — white */}
        <section className="mx-4 mb-16 md:mx-8 lg:mx-auto lg:max-w-7xl">
          <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-white p-6 md:p-12">
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
              <div className="hidden justify-center lg:flex">
                <MascotFrame src="/mascot/mascot_happy.png" alt="" size="sm" />
              </div>
              <div className="text-center lg:col-span-1 lg:text-left">
                <SectionLabel>Take the next step</SectionLabel>
                <h2 className="text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
                  {isAuthenticated ? "Need a moment of calm?" : "Ready to find your balance?"}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-on-surface-variant md:text-base">
                  {isAuthenticated
                    ? "Start a check-in or open the agent — Mizan adapts to how you feel today."
                    : "Join as a student or bring your school onboard. Secure auth, private data, Mistral-powered guidance."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                  {isAuthenticated ? (
                    <>
                      <Button asChild size="lg" className="rounded-xl px-8">
                        <Link href="/checkin">Start check-in</Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="rounded-xl bg-surface">
                        <Link href="/resources">Browse resources</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button asChild size="lg" className="rounded-xl px-8">
                        <Link href="/login">Student login</Link>
                      </Button>
                      <Button asChild size="lg" variant="secondary" className="rounded-xl bg-surface">
                        <Link href="/admin/login">Admin access</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden justify-center lg:flex">
                <MascotFrame src="/mascot/mascot_focus.png" alt="" size="sm" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 md:flex-row md:px-8">
          <Image src="/MIZAN_FULL_LOGO.png" alt="Mizan" width={100} height={32} className="h-8 w-auto opacity-90" />
          <p className="text-center text-xs text-on-surface-variant md:text-left">
            Mizan — student wellbeing with balance · JWT auth · Mistral agent · Built for ENSET & beyond
          </p>
          {!isAuthenticated ? (
            <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-on-surface-variant">
              <Link href="/login" className="hover:text-primary">Students</Link>
              <Link href="/admin/login" className="hover:text-primary">Admins</Link>
              <Link href="/admin/register" className="hover:text-primary">Register</Link>
            </div>
          ) : (
            <Link href="/profile" className="text-xs font-semibold text-primary hover:underline">
              Your profile
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
