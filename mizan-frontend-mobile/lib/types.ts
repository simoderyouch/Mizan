export type UUID = string;

export type UserRole = "ADMIN" | "STUDENT";
export type StressLevel = "LOW" | "MEDIUM" | "HIGH";
export type VoicePeriod = "MORNING" | "EVENING";
export type CheckinPeriod = "MORNING" | "EVENING";
export type CheckinQuestionMode = "qcm" | "voice";
export type CheckinAnswerType =
  | "text"
  | "number"
  | "scale"
  | "time_hours"
  | "single_choice"
  | "multi_choice"
  | "boolean"
  | "voice_text";
export type CheckinTargetField = "mood_score" | "sleep_hours" | "plan_completed" | "notes" | "context";
export type ResourceType = "VIDEO" | "ARTICLE" | "EXERCISE";
export type Mode = "REVISION" | "EXAMEN" | "PROJET" | "REPOS" | "SPORT" | "COURS";

export interface ApiMessageResponse {
  message: string;
}

export interface ApiValidationDetail {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface ApiErrorResponse {
  detail?: string | ApiValidationDetail[] | Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

// System
export interface HealthResponse {
  status: string;
}

export interface DetailedHealthResponse {
  status: string;
  database: string;
  services: string[];
}

// Auth
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

export interface TempTokenResponse {
  temp_token: string;
}

export interface CurrentUser {
  id: UUID;
  email: string;
  role: UserRole | string;
  school_id?: UUID | null;
}

export interface RequestActivationPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface SetPasswordPayload {
  token: string;
  new_password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshTokenPayload {
  refresh_token: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

// Institution
export interface School {
  id: UUID;
  name: string;
  official_identifier?: string | null;
  contact_phone?: string | null;
  verification_status: "PENDING" | "VERIFIED" | "REJECTED";
  verification_note?: string | null;
  created_at: string;
}

export interface SchoolCreatePayload {
  name: string;
  admin_email: string;
  admin_password: string;
  official_identifier: string;
  contact_phone: string;
}

export interface Filiere {
  id: UUID;
  name: string;
  school_id: UUID;
}

export interface FiliereCreatePayload {
  name: string;
  school_id?: UUID;
}

export interface Promotion {
  id: UUID;
  name: string;
  filiere_id: UUID;
}

export interface PromotionCreatePayload {
  name: string;
  filiere_id: UUID;
}

export interface Class {
  id: UUID;
  name: string;
  promotion_id: UUID;
  academic_year: string;
}

export interface ClassCreatePayload {
  name: string;
  promotion_id: UUID;
  academic_year: string;
}

// Students
export interface Student {
  id: UUID;
  user_id: UUID;
  class_id: UUID;
  class_name?: string | null;
  filiere_name?: string | null;
  email?: string | null;
  first_name: string;
  last_name: string;
  cne: string;
  phone?: string | null;
  photo_url?: string | null;
  created_at: string;
}

export interface StudentCreatePayload {
  email: string;
  class_id: UUID;
  first_name: string;
  last_name: string;
  cne: string;
  phone?: string;
  photo_url?: string;
}

export interface StudentUpdatePayload {
  class_id?: UUID;
  first_name?: string;
  last_name?: string;
  cne?: string;
  phone?: string | null;
  photo_url?: string | null;
}

// Class content
export interface ScheduleEntry {
  id: UUID;
  student_id: UUID;
  subject: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  professor: string;
}

export interface Exam {
  id: UUID;
  student_id: UUID;
  subject: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface Project {
  id: UUID;
  student_id: UUID;
  name: string;
  subject: string;
  due_date: string;
  members: string[];
}

export interface ScheduleCreatePayload {
  subject: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room?: string;
  professor?: string;
}

export interface ScheduleUpdatePayload {
  subject?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  professor?: string;
}

export interface ExamCreatePayload {
  subject: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room?: string;
}

export interface ExamUpdatePayload {
  subject?: string;
  exam_date?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

export interface ProjectCreatePayload {
  name: string;
  subject: string;
  due_date: string;
  members?: string[];
}

export interface ProjectUpdatePayload {
  name?: string;
  subject?: string;
  due_date?: string;
  members?: string[];
}

export interface StudentContext {
  student: Student;
  today_schedule: ScheduleEntry[];
  upcoming_exams: Exam[];
  active_projects: Project[];
  current_mode?: ModeSession | null;
}

// Check-ins
export interface MorningCheckinCreatePayload {
  sleep_hours?: number;
  mood_score?: number;
  mode?: string;
  question_set?: CheckinQuestion[];
  responses?: CheckinAnswerPayload[];
  executive_summary?: string;
  detailed_action_plan?: string[];
  detected_risks?: string[];
}

export interface EveningCheckinCreatePayload {
  plan_completed?: boolean;
  mood_score?: number;
  notes?: string;
  mode?: string;
  question_set?: CheckinQuestion[];
  responses?: CheckinAnswerPayload[];
  executive_summary?: string;
  detailed_action_plan?: string[];
  detected_risks?: string[];
}

export interface MorningCheckinResponse {
  id: UUID;
  student_id: UUID;
  date: string;
  sleep_hours: number;
  mood_score: number;
  mode: string;
  executive_summary: string | null;
  detailed_action_plan: string[] | null;
  detected_risks: string[] | null;
  question_set?: CheckinQuestion[] | null;
  question_answers?: CheckinAnswerPayload[] | null;
  checkin_time: string;
}

export interface EveningCheckinResponse {
  id: UUID;
  student_id: UUID;
  date: string;
  plan_completed: boolean;
  mood_score: number;
  notes?: string | null;
  mode: string;
  executive_summary: string | null;
  detailed_action_plan: string[] | null;
  detected_risks: string[] | null;
  question_set?: CheckinQuestion[] | null;
  question_answers?: CheckinAnswerPayload[] | null;
  checkin_time: string;
}

export interface MorningBriefing {
  today_schedule: ScheduleEntry[];
  upcoming_exams: Exam[];
  upcoming_projects: Project[];
  last_evening_mood: number | null;
  suggested_mode: Mode | string;
  priority_items: string[];
  wellbeing_alert: "NONE" | "MEDIUM" | "HIGH" | string;
  checkin_status: {
    has_morning_today: boolean;
    has_evening_today: boolean;
  };
}

export interface CheckinHistoryResponse {
  morning_checkins: MorningCheckinResponse[];
  evening_checkins: EveningCheckinResponse[];
  averages: {
    morning_mood: number;
    evening_mood: number;
    sleep_hours: number;
  };
  consistency: {
    morning_streak_days: number;
    evening_streak_days: number;
    morning_completion_rate: number;
    evening_completion_rate: number;
  };
}

export interface CheckinQuestion {
  id: string;
  text: string;
  answer_type: CheckinAnswerType;
  required: boolean;
  target_field?: CheckinTargetField | null;
  min_value?: number | null;
  max_value?: number | null;
  step?: number | null;
  options?: string[] | null;
}

export interface CheckinAnswerPayload {
  question_id: string;
  value: string | number | boolean | string[];
}

export interface PersonalizedCheckinQuestionsResponse {
  period: CheckinPeriod;
  mode: CheckinQuestionMode;
  questions: CheckinQuestion[];
}

// Goals
export interface Goal {
  id: UUID;
  student_id: UUID;
  title: string;
  target_value: number;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export interface GoalCreatePayload {
  title: string;
  target_value: number;
  unit: string;
}

export interface GoalProgressCreatePayload {
  goal_id: UUID;
  value: number;
  note?: string;
}

export interface GoalProgress {
  id: UUID;
  goal_id: UUID;
  date: string;
  value: number;
  note?: string | null;
  created_at: string;
}

export interface GoalWithProgress {
  id: UUID;
  student_id: UUID;
  title: string;
  target_value: number;
  unit: string;
  is_active: boolean;
  today_progress: number;
  total_progress: number;
  completion_percentage: number;
  remaining_value: number;
  is_achieved: boolean;
  progress_history: GoalProgress[];
}

export interface GoalTodaySummary {
  goal_id: UUID;
  title: string;
  target_value: number;
  unit: string;
  today_value: number;
  total_value: number;
  remaining_value: number;
  completion_percentage: number;
  achieved: boolean;
}

// Tasks
export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskSource = "morning_checkin" | "chat" | "voice_chat" | "manual" | "agent";

export interface Task {
  id: UUID;
  student_id: UUID;
  title: string;
  description?: string | null;
  due_date: string;
  source: TaskSource | string;
  status: TaskStatus | string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  due_date?: string;
  source?: TaskSource;
}

export interface TaskBulkCreatePayload {
  tasks: TaskCreatePayload[];
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  due_date?: string;
}

export interface ChatTaskSuggestion {
  title: string;
  description?: string | null;
}

export interface ChatTaskSuggestionResponse {
  suggestions: ChatTaskSuggestion[];
}

// Notifications
export type NotificationType = "info" | "warning" | "wellbeing" | "task" | "mode";

export interface Notification {
  id: UUID;
  student_id: UUID;
  type: NotificationType | string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

// Modes
export interface ModeSession {
  id: UUID;
  student_id: UUID;
  mode: Mode;
  started_at: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
}

export interface ModeSessionCreatePayload {
  mode: Mode;
}

export interface ModeStatItem {
  mode: Mode;
  total_minutes: number;
  percentage: number;
}

export interface ModeStats {
  today: ModeStatItem[];
  this_week: ModeStatItem[];
  current_session?: ModeSession | null;
}

// Analytics
export interface MoodGraphPoint {
  date: string;
  mood_score: number;
  sleep_hours: number;
}

export interface ModeDistribution {
  mode: string;
  total_minutes: number;
  percentage: number;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  avg_mood: number;
  avg_sleep: number;
  total_checkins: number;
  goals_achieved: number;
  mode_distribution: ModeDistribution[];
  stress_level: StressLevel | string;
}

export interface StudentDashboard {
  student: Student;
  current_mode?: ModeSession | null;
  has_morning_checkin: boolean;
  has_evening_checkin: boolean;
  active_goals_count: number;
  upcoming_exams: Exam[];
  today_schedule: ScheduleEntry[];
  mood_trend: MoodGraphPoint[];
}

export interface AdminKpis {
  schools_count: number;
  filieres_count: number;
  promotions_count: number;
  classes_count: number;
  students_count: number;
  activated_students_count: number;
  morning_checkin_today_count: number;
  evening_checkin_today_count: number;
}

export interface AdminClassHealth {
  class_id: UUID;
  class_name: string;
  filiere_name: string;
  promotion_name: string;
  students_count: number;
  activated_students_count: number;
  schedule_coverage_pct: number;
  exams_coverage_pct: number;
  projects_coverage_pct: number;
  morning_checkin_today_pct: number;
  low_mood_students_7d: number;
  school_name?: string;
}

export interface AdminRiskStudent {
  student_id: UUID;
  full_name: string;
  class_name: string;
  filiere_name: string;
  avg_mood_7d: number;
  overdue_projects: number;
  has_exam_within_48h: boolean;
  school_name?: string;
}

export interface AdminDashboardData {
  kpis: AdminKpis;
  classes_health: AdminClassHealth[];
  risk_students: AdminRiskStudent[];
}

// Voice
export interface VoiceQuestion {
  index: number;
  id: string;
  text: string;
  answer_type: CheckinAnswerType;
  target_field?: CheckinTargetField | null;
  audio_base64?: string | null;
  audio_url?: string | null;
}

export interface VoiceSessionResponse {
  session_id: string;
  questions: VoiceQuestion[];
  first_audio_base64: string;
}

export interface VoiceTranscriptionPayload {
  question_index: number;
  question_id?: string;
  transcription: string;
}

export interface VoiceSessionSubmitPayload {
  session_id?: UUID;
  period: VoicePeriod;
  transcriptions: VoiceTranscriptionPayload[];
}

export interface VoiceAnalysis {
  analysis: string;
  mood_score: number;
  sleep_hours?: number | null;
  recommendations: string[];
  parsed_answers?: CheckinAnswerPayload[] | null;
  saved_checkin_id: UUID;
}

export interface VoiceTranscribeResponse {
  transcription: string;
}

// Resources
export interface Resource {
  id: UUID;
  title: string;
  description?: string | null;
  category: string;
  type: ResourceType;
  url: string;
  tags: string[];
  mood_trigger: string;
  ai_instruction?: string | null;
  created_at: string;
}

export interface ResourceCreatePayload {
  title: string;
  description?: string;
  category: string;
  type: ResourceType;
  url: string;
  tags: string[];
  mood_trigger: string;
  ai_instruction?: string;
}

export interface ResourceUpdatePayload {
  title?: string;
  description?: string;
  category?: string;
  type?: ResourceType;
  url?: string;
  tags?: string[];
  mood_trigger?: string;
  ai_instruction?: string;
}

// Files
export interface PhotoUploadResponse {
  photo_url: string;
}

// Agent
export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceChatRequest {
  user_text: string;
  history: AgentChatMessage[];
}

export interface VoiceChatResponse {
  agent_text: string;
  agent_audio_base64: string;
}



export interface AgentPlanPayload {
  sleep_hours: number;
  mood_score: number;
}

export interface AgentPlanResponse {
  plan: string;
}

export interface AgentChatResponse {
  response: string;
}

export interface AgentTestDecision {
  id: UUID;
  action: string;
  thought?: string | null;
  confidence?: number | null;
  result?: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentTestRun {
  id: UUID;
  trigger_type: string;
  idempotency_key: string;
  status: string;
  reasoning_summary?: string | null;
  created_at: string;
  decisions: AgentTestDecision[];
}

export interface AgentTestTriggerPayload {
  event_type: string;
  note?: string;
}

export interface AgentTestTriggerResponse {
  run: AgentTestRun;
}

export interface AgentActionContract {
  id: UUID;
  student_id: UUID;
  run_id: UUID;
  task_id?: UUID | null;
  contract_text: string;
  adaptive_level: "standard" | "gentle" | "micro" | string;
  status: "pending" | "accepted" | "declined" | "completed" | string;
  due_at: string;
  followup_at: string;
  responded_at?: string | null;
  completed_at?: string | null;
  followup_sent_at?: string | null;
  created_at: string;
}
