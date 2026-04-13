import type {
  AdminClassHealth,
  AdminDashboardData,
  AdminKpis,
  AdminRiskStudent,
  Class,
  CurrentUser,
  Exam,
  Filiere,
  Project,
  Promotion,
  School,
  Student,
} from "@/lib/types";

export type { CurrentUser, School, Filiere, Promotion, Class, Student, Exam, Project };

export interface Schedule {
  id: string;
  student_id: string;
  subject: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  professor: string;
}

export interface PlatformTrendPoint {
  date: string;
  checkin_count: number;
  avg_mood: number;
}

export interface InstitutionalStat {
  school_id: string;
  school_name: string;
  students_count: number;
  active_students_pct: number;
  avg_mood: number;
  engagement_pct: number;
  at_risk_count: number;
}

export interface AdminDashboardResponse {
  kpis: AdminKpis;
  classes_health: AdminClassHealth[];
  platform_trends: PlatformTrendPoint[];
  institutional_stats: InstitutionalStat[];
  risk_students: AdminRiskStudent[];
}

export type AdminDashboardResponseCompat = AdminDashboardData;
