"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarRange,
  GraduationCap,
  Layers,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { analyticsApi, getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminDashboardResponse } from "@/lib/admin-types";
import { EmptyState, ErrorState } from "@/components/admin/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type KpiKey = keyof AdminDashboardResponse["kpis"];

const KPI_CONFIG: Array<{
  key: KpiKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { key: "filieres_count", label: "Filieres", icon: Layers, accent: "#005cae" },
  { key: "promotions_count", label: "Promotions", icon: GraduationCap, accent: "#004584" },
  { key: "classes_count", label: "Classes", icon: Building2, accent: "#4090ff" },
  { key: "students_count", label: "Students", icon: Users, accent: "#005cae" },
  { key: "activated_students_count", label: "Activated", icon: BookOpenCheck, accent: "#10b981" },
  { key: "morning_checkin_today_count", label: "Morning check-ins", icon: CalendarRange, accent: "#4090ff" },
  { key: "evening_checkin_today_count", label: "Evening check-ins", icon: CalendarRange, accent: "#005cae" },
];

const COV_COLOR = {
  schedule: "#005cae",
  exams: "#4090ff",
  projects: "#10b981",
};

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_dashboard_filter");
    }
    return null;
  });

  useEffect(() => {
    if (selectedClassFilter) {
      sessionStorage.setItem("admin_dashboard_filter", selectedClassFilter);
    } else {
      sessionStorage.removeItem("admin_dashboard_filter");
    }
  }, [selectedClassFilter]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await analyticsApi.adminDashboard();
      setDashboard(data);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load admin analytics."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const healthData = useMemo(() => {
    if (!dashboard?.classes_health?.length) return [];
    return dashboard.classes_health.slice(0, 8).map((item) => ({
      className: item.class_name,
      students: item.students_count,
      activated: item.activated_students_count,
      morning: Math.round(item.morning_checkin_today_pct),
    }));
  }, [dashboard]);

  const coverageData = useMemo(() => {
    if (!dashboard?.classes_health?.length) return [];
    return dashboard.classes_health.slice(0, 8).map((item) => ({
      className: item.class_name,
      schedule: Number(item.schedule_coverage_pct.toFixed(1)),
      exams: Number(item.exams_coverage_pct.toFixed(1)),
      projects: Number(item.projects_coverage_pct.toFixed(1)),
    }));
  }, [dashboard]);

  const filteredRiskStudents = useMemo(() => {
    if (!dashboard?.risk_students) return [];
    if (!selectedClassFilter) return dashboard.risk_students;
    return dashboard.risk_students.filter((s) => s.class_name === selectedClassFilter);
  }, [dashboard, selectedClassFilter]);

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const className = data.activePayload[0].payload.className;
      setSelectedClassFilter((prev) => (prev === className ? null : className));
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">Dashboard</h1>
          <p className="mt-2 text-base text-on-surface-variant">Real-time command center for institutions and risk monitoring.</p>
        </div>
        <Button variant="ghost" onClick={() => void loadDashboard()} disabled={loading} className="rounded-xl border-none bg-surface-container-low shadow-sm transition-all hover:bg-surface-container-high">
          {loading ? "Syncing..." : "Refresh analytics"}
        </Button>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void loadDashboard()} /> : null}

      {loading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: KPI_CONFIG.length }).map((_, idx) => (
              <Skeleton key={idx} className="h-32 rounded-2xl bg-white" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Skeleton className="h-[340px] rounded-2xl bg-white xl:col-span-2" />
            <Skeleton className="h-[340px] rounded-2xl bg-white" />
            <Skeleton className="h-[340px] rounded-2xl bg-white xl:col-span-2" />
            <Skeleton className="h-[340px] rounded-2xl bg-white" />
          </div>
        </>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_CONFIG.map((item) => {
              const Icon = item.icon;
              const value = dashboard?.kpis[item.key] ?? 0;
              return (
                <Card key={item.key} className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary transition-all hover:scale-[1.02] hover:shadow-sanctuary-lg">
                  <CardContent className="space-y-4 !p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{item.label}</span>
                      <div className="rounded-xl p-2.5 transition-colors" style={{ backgroundColor: `${item.accent}15`, color: item.accent }}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tracking-tight text-on-surface">{value.toLocaleString()}</p>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-xl font-bold text-on-surface">Class health</CardTitle>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70">Risk distribution</p>
                </div>
                {selectedClassFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClassFilter(null)} className="h-8 rounded-lg text-primary hover:bg-primary/5">
                    Clear filter
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col !pb-4">
                {healthData.length === 0 ? (
                  <EmptyState
                    title="No class health data yet"
                    message="Create classes and enroll students to generate health metrics."
                    actionLabel="Go to classes"
                    onAction={() => {
                      window.location.assign("/admin/classes");
                    }}
                  />
                ) : (
                  <div className="flex-1 min-h-[240px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={healthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} onClick={handleBarClick}>
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="currentColor" className="text-surface-container-highest" opacity={0.5} />
                        <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 92, 174, 0.05)" }}
                          contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", backgroundColor: "#fff" }}
                        />
                        <Bar dataKey="students" fill="#d5e3ff" radius={[4, 4, 0, 0]} name="Students" cursor="pointer" maxBarSize={40} />
                        <Bar dataKey="activated" fill="#005cae" radius={[4, 4, 0, 0]} name="Activated" cursor="pointer" maxBarSize={40} />
                        <Bar dataKey="morning" fill="#10b981" radius={[4, 4, 0, 0]} name="Morning check-in %" cursor="pointer" maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/admin/classes" className="block">
                  <Button className="group w-full justify-between rounded-xl py-6 bg-primary text-on-primary shadow-sanctuary transition-all hover:shadow-sanctuary-lg">
                    Go to academy operations
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/admin/resources" className="block">
                  <Button variant="ghost" className="w-full justify-between rounded-xl py-6 border-none bg-surface-container-low hover:bg-surface-container-high transition-colors text-primary">
                    Manage resources
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <div className="pt-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    Shortcuts
                  </p>
                  <TooltipProvider delayDuration={150}>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Filiere", href: "/admin/classes?create=filiere" },
                        { label: "Promotion", href: "/admin/classes?create=promotion" },
                        { label: "Class", href: "/admin/classes?create=class" },
                      ].map((shortcut) => (
                        <Tooltip key={shortcut.label}>
                          <TooltipTrigger asChild>
                            <Link href={shortcut.href}>
                              <Button variant="ghost" size="sm" className="w-full rounded-xl bg-surface-container-low hover:bg-surface-container-high text-xs">
                                {shortcut.label}
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent className="border-none bg-surface-container-high text-on-surface shadow-sanctuary">Create {shortcut.label.toLowerCase()}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold text-on-surface">Coverage metrics</CardTitle>
                <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70">Syllabus progression</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col !pb-4">
                {coverageData.length === 0 ? (
                  <EmptyState title="No coverage data yet" message="Upload class content to reveal schedule, exam, and project coverage." />
                ) : (
                  <div className="flex-1 min-h-[280px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={coverageData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="currentColor" className="text-surface-container-highest" opacity={0.5} />
                        <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} domain={[0, 100]} />
                        <RechartsTooltip
                          formatter={(value: number) => `${value.toFixed(1)}%`}
                          contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", backgroundColor: "#fff" }}
                        />
                        <Bar dataKey="schedule" name="Schedule" radius={[4, 4, 0, 0]} maxBarSize={30}>
                          {coverageData.map((entry, idx) => (
                            <Cell key={`schedule-${entry.className}-${idx}`} fill={COV_COLOR.schedule} />
                          ))}
                        </Bar>
                        <Bar dataKey="exams" name="Exams" radius={[4, 4, 0, 0]} maxBarSize={30}>
                          {coverageData.map((entry, idx) => (
                            <Cell key={`exams-${entry.className}-${idx}`} fill={COV_COLOR.exams} />
                          ))}
                        </Bar>
                        <Bar dataKey="projects" name="Projects" radius={[4, 4, 0, 0]} maxBarSize={30}>
                          {coverageData.map((entry, idx) => (
                            <Cell key={`projects-${entry.className}-${idx}`} fill={COV_COLOR.projects} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                   <CardTitle className="text-xl font-bold">Risk signals</CardTitle>
                   <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70">Performance alerts</p>
                </div>
                <Badge variant="secondary" className="border-none text-primary bg-primary/5">{filteredRiskStudents.length} Students</Badge>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRiskStudents.length ? (
                  filteredRiskStudents.slice(0, 10).map((student) => (
                    <div key={student.student_id} className="group rounded-2xl bg-surface-container-low p-4 transition-all hover:bg-surface-container-high">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{student.full_name}</p>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                            {student.class_name} · {student.filiere_name}
                          </p>
                        </div>
                        <Badge variant={student.avg_mood_7d <= 2.5 ? "destructive" : "warning"} className="rounded-lg">
                          {student.avg_mood_7d.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                          {student.overdue_projects} Overdue
                        </span>
                        {student.has_exam_within_48h ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                             Exam &lt; 48h
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No risk signals" message={selectedClassFilter ? `No alerts for class ${selectedClassFilter}.` : "Perfect stability across all metrics."} />
                )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
              <CardHeader className="flex flex-row items-center justify-between pb-6">
                <div>
                  <CardTitle className="text-xl font-bold">Prioritized risk monitoring</CardTitle>
                  {selectedClassFilter && <p className="text-xs text-on-surface-variant font-medium mt-1">Filtering by: <span className="text-primary font-bold">{selectedClassFilter}</span></p>}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-700/10">
                  <AlertTriangle className="h-3 w-3" />
                  Live alerts
                </div>
              </CardHeader>
              <CardContent>
                {filteredRiskStudents.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-surface-container-high hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Student</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Class</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Filiere</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Avg mood (7d)</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant text-center">Overdue</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant text-right">Exam ≤ 48h</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRiskStudents.map((student) => (
                          <TableRow key={student.student_id} className="border-surface-container-low transition-colors hover:bg-surface-container-low/50">
                            <TableCell className="py-4 font-bold text-on-surface">{student.full_name}</TableCell>
                            <TableCell className="py-4 text-on-surface-variant font-medium">{student.class_name}</TableCell>
                            <TableCell className="py-4 text-on-surface-variant font-medium">{student.filiere_name}</TableCell>
                            <TableCell className="py-4">
                               <Badge variant={student.avg_mood_7d <= 2.5 ? "destructive" : "warning"} className="rounded-lg shadow-sm">
                                  {student.avg_mood_7d.toFixed(2)}
                               </Badge>
                            </TableCell>
                            <TableCell className="py-4 text-center">
                               <span className={cn("text-sm font-bold", student.overdue_projects > 2 ? "text-red-600" : "text-on-surface-variant")}>
                                 {student.overdue_projects}
                               </span>
                            </TableCell>
                            <TableCell className="py-4 text-right">
                               {student.has_exam_within_48h ? 
                                 <Badge className="bg-amber-100 text-amber-700 border-none shadow-none">Urgent</Badge> : 
                                 <span className="text-on-surface-variant/40">—</span>
                               }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState title="No records found" message="No students match the current alert thresholds." />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {dashboard?.classes_health?.length ? (
        <div className="overflow-hidden rounded-3xl bg-primary px-8 py-6 text-on-primary shadow-sanctuary-lg relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-primary/70">Coverage snapshot</p>
          <div className="mt-4 flex flex-wrap items-center gap-8 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-on-primary/60">Schedule</p>
              <p className="text-2xl font-bold">{formatPct(dashboard.classes_health.reduce((acc, item) => acc + item.schedule_coverage_pct, 0) / dashboard.classes_health.length)}</p>
            </div>
            <div className="w-px h-10 bg-on-primary/10" />
            <div className="space-y-1">
              <p className="text-xs text-on-primary/60">Exams</p>
              <p className="text-2xl font-bold">{formatPct(dashboard.classes_health.reduce((acc, item) => acc + item.exams_coverage_pct, 0) / dashboard.classes_health.length)}</p>
            </div>
            <div className="w-px h-10 bg-on-primary/10" />
            <div className="space-y-1">
              <p className="text-xs text-on-primary/60">Projects</p>
              <p className="text-2xl font-bold">{formatPct(dashboard.classes_health.reduce((acc, item) => acc + item.projects_coverage_pct, 0) / dashboard.classes_health.length)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
