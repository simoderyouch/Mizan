"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CalendarRange,
  Globe,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

type KpiKey = keyof AdminDashboardResponse["kpis"];

const KPI_CONFIG: Array<{
  key: KpiKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { key: "schools_count", label: "Institutions", icon: Building2, accent: "#005cae" },
  { key: "students_count", label: "Total Students", icon: Users, accent: "#004584" },
  { key: "activated_students_count", label: "Active Users", icon: BookOpenCheck, accent: "#10b981" },
  { key: "morning_checkin_today_count", label: "Daily Mornings", icon: CalendarRange, accent: "#4090ff" },
];

export default function GlobalDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await analyticsApi.adminDashboard();
      setDashboard(data);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load global platform analytics."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const trendData = useMemo(() => {
    if (!dashboard?.platform_trends?.length) return [];
    return dashboard.platform_trends.map(t => ({
      date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: t.checkin_count,
      mood: t.avg_mood
    }));
  }, [dashboard]);

  return (
    <div className="animate-fade-in space-y-10 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-container-high pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sanctuary">
             <Globe className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">Global Command Center</h1>
            <p className="text-sm text-on-surface-variant font-medium">Platform-wide statistics, multi-institutional analytics, and risk management.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="secondary" onClick={loadDashboard} disabled={loading} className="rounded-xl border-none bg-surface-container-low shadow-sm hover:bg-surface-container-high">
             Refresh Data
           </Button>
           <Button asChild className="rounded-xl bg-primary text-on-primary shadow-sanctuary group">
             <Link href="/admin/global/verification">
               <ShieldCheck className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
               Institutional Access Hub
             </Link>
           </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadDashboard} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-surface-container-lowest shadow-sm" />
          ))}
        </div>
      ) : dashboard ? (
        <div className="space-y-12">
          {/* SECTION: PLATFORM STATISTICS */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/80">Platform Statistics</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {KPI_CONFIG.map((item) => {
                const Icon = item.icon;
                const value = dashboard.kpis[item.key] ?? 0;
                return (
                  <Card key={item.key} className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary transition-all hover:scale-[1.02]">
                    <CardContent className="space-y-4 !p-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{item.label}</span>
                        <div className="rounded-xl p-2.5" style={{ backgroundColor: `${item.accent}15`, color: item.accent }}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-on-surface">{value.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* SECTION: ANALYTICS TRENDS */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/80">Engagement Analytics</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Platform-Wide Engagement</CardTitle>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70">Daily Check-in Activity (Last 7 Days)</p>
                </CardHeader>
                <CardContent className="flex-1 min-h-[300px]">
                  {trendData.length === 0 ? (
                    <EmptyState title="Awaiting Data" message="Trends will populate as schools begin their morning routines." />
                  ) : (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#005cae" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#005cae" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.3} />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <RechartsTooltip 
                             contentStyle={{ borderRadius: "20px", border: "none", boxShadow: "0 20px 40px rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)" }}
                             itemStyle={{ fontWeight: "bold", fontSize: "12px" }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#005cae" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                            animationDuration={1500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="flex flex-col overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                     <CardTitle className="text-xl font-bold">Institutional Risk Scopes</CardTitle>
                     <p className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/70">Aggregate Wellbeing Alerts by School</p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {dashboard.institutional_stats.filter(s => s.at_risk_count > 0).length ? (
                    dashboard.institutional_stats
                      .filter(s => s.at_risk_count > 0)
                      .sort((a, b) => b.at_risk_count - a.at_risk_count)
                      .map((school) => (
                        <div key={school.school_id} className="rounded-2xl bg-surface-container-low p-4 transition-all hover:bg-surface-container-high shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-on-surface">{school.school_name}</p>
                              <p className="text-[10px] font-medium text-on-surface-variant mt-0.5">
                                {school.students_count} Students · {school.engagement_pct}% Engagement
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="destructive" className="rounded-lg shrink-0">
                                {school.at_risk_count} At Risk
                              </Badge>
                              <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">Mood: {school.avg_mood.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <EmptyState title="Status Nominal" message="No institutional scopes require immediate attention at this aggregate level." />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* SECTION: INSTITUTIONAL PERFORMANCE */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/80">Institutional Performance Matrix</h2>
            </div>
            <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-surface-container-high hover:bg-transparent">
                        <TableHead className="py-5 pl-8 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Institution</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Active Students</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Stability Score</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Daily Engagement</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Risk Scope</TableHead>
                        <TableHead className="pr-8 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.institutional_stats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-on-surface-variant">
                            No institutional data available yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dashboard.institutional_stats.map((inst) => (
                          <TableRow key={inst.school_id || inst.school_name} className="border-surface-container-low transition-colors hover:bg-surface-container-low/50">
                            <TableCell className="py-6 pl-8">
                               <div className="flex items-center gap-3">
                                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                                   <Building2 className="h-5 w-5" />
                                 </div>
                                 <div className="space-y-1">
                                   <p className="text-sm font-bold leading-none text-on-surface">{inst.school_name}</p>
                                   <p className="text-[10px] font-medium text-on-surface-variant">{inst.students_count} Total Students</p>
                                 </div>
                               </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-2">
                                 <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container-high">
                                   <div 
                                     className="h-full bg-primary transition-all duration-1000" 
                                     style={{ width: `${inst.active_students_pct}%` }} 
                                   />
                                 </div>
                                 <span className="text-xs font-bold">{inst.active_students_pct}%</span>
                               </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-2">
                                 <div className="flex h-2 w-2 rounded-full bg-green-500" />
                                 <span className="text-xs font-semibold">{inst.avg_mood.toFixed(1)} / 5.0</span>
                               </div>
                            </TableCell>
                             <TableCell>
                               <Badge className={cn(
                                 "rounded-lg border-none shadow-none",
                                 inst.engagement_pct > 70 ? "bg-emerald-100 text-emerald-700" : 
                                 inst.engagement_pct > 40 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                               )}>
                                 {inst.engagement_pct}%
                               </Badge>
                            </TableCell>
                            <TableCell>
                               {inst.at_risk_count > 0 ? (
                                 <Badge className="bg-red-50 text-red-600 border-none shadow-none rounded-lg">
                                   {inst.at_risk_count} Critical
                                 </Badge>
                               ) : (
                                 <span className="text-xs font-medium text-on-surface-variant/50">Optimal</span>
                               )}
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                              <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs font-bold hover:bg-surface-container-high">
                                <Link href={`/admin/global/schools`}>
                                   View Details
                                   <ArrowRight className="ml-2 h-3 w-3" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      ) : (
        <EmptyState title="No Analytics Available" message="Platform-wide data will begin to aggregate as more institutions activate their accounts." onAction={loadDashboard} actionLabel="Refresh Dashboard" />
      )}
    </div>
  );
}
