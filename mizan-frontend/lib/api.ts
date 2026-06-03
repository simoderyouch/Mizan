import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import type { AdminDashboardResponse } from "@/lib/admin-types";
import type {
  AdminDashboardData,
  AgentChatMessage,
  AgentChatResponse,
  AgentActionContract,
  AgentPlanPayload,
  AgentPlanResponse,
  ApiErrorResponse,
  ApiMessageResponse,
  CheckinHistoryResponse,
  ChangePasswordPayload,
  Class,
  ClassCreatePayload,
  CheckinPeriod,
  CheckinQuestionMode,
  CurrentUser,
  DetailedHealthResponse,
  EveningCheckinCreatePayload,
  EveningCheckinResponse,
  Exam,
  ExamCreatePayload,
  ExamUpdatePayload,
  Filiere,
  FiliereCreatePayload,
  Goal,
  GoalCreatePayload,
  GoalProgress,
  GoalProgressCreatePayload,
  GoalTodaySummary,
  GoalWithProgress,
  Task,
  TaskBulkCreatePayload,
  TaskUpdatePayload,
  TaskStatus,
  ChatTaskSuggestionResponse,
  HealthResponse,
  LoginPayload,
  ModeSession,
  ModeStats,
  MoodGraphPoint,
  MorningBriefing,
  MorningCheckinCreatePayload,
  MorningCheckinResponse,
  PersonalizedCheckinQuestionsResponse,
  PhotoUploadResponse,
  Project,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  Promotion,
  PromotionCreatePayload,
  RefreshTokenPayload,
  RefreshTokenResponse,
  Resource,
  ResourceCreatePayload,
  ResourceUpdatePayload,
  ScheduleCreatePayload,
  ScheduleEntry,
  ScheduleUpdatePayload,
  School,
  SchoolCreatePayload,
  SetPasswordPayload,
  Student,
  StudentContext,
  StudentCreatePayload,
  StudentDashboard,
  StudentUpdatePayload,
  TempTokenResponse,
  TokenResponse,
  VerifyOtpPayload,
  VoiceAnalysis,
  VoicePeriod,
  VoiceSessionResponse,
  VoiceSessionSubmitPayload,
  VoiceTranscribeResponse,
  VoiceChatRequest,
  VoiceChatResponse,
  WeeklyReport,
  Notification,
} from "@/lib/types";

const API_PREFIX = "/api/v1";
/** Direct backend URL (WebSockets, health). HTTP calls may use Next proxy in dev. */
const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "mizan_access_token";
const REFRESH_TOKEN_KEY = "mizan_refresh_token";

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

/** Use Next.js `/api/v1` rewrite — avoids browser CORS in local dev. */
const usesApiProxy = (raw: string | undefined): boolean => {
  if (raw === undefined) return process.env.NODE_ENV === "development";
  const t = raw.trim().toLowerCase();
  return t === "" || t === "proxy" || t === "same-origin";
};

const toDirectOrigin = (raw: string | undefined): string => {
  const fallback = trimTrailingSlashes(DEFAULT_BACKEND_ORIGIN);
  if (usesApiProxy(raw)) return fallback;
  if (!raw) return fallback;
  const candidate = trimTrailingSlashes(raw.trim());
  if (!candidate || candidate.startsWith("/")) return fallback;
  if (candidate.endsWith(API_PREFIX)) {
    const stripped = candidate.slice(0, -API_PREFIX.length);
    return stripped || fallback;
  }
  return candidate;
};

const proxyEnv = process.env.NEXT_PUBLIC_API_URL;
export const API_USES_PROXY = usesApiProxy(proxyEnv);
/** Empty when using Next proxy; otherwise absolute backend origin. */
export const API_ORIGIN = API_USES_PROXY ? "" : toDirectOrigin(proxyEnv);
export const BACKEND_ORIGIN = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || toDirectOrigin(proxyEnv)
);
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}${API_PREFIX}` : API_PREFIX;

const isBrowser = () => typeof window !== "undefined";

/** Direct HTTP origin for WebSockets and long-running calls (browser-safe in production). */
export const resolveDirectBackendOrigin = (): string => {
  const configured = process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  if (configured) return trimTrailingSlashes(configured);
  if (API_USES_PROXY && isBrowser()) {
    return trimTrailingSlashes(window.location.origin);
  }
  return API_ORIGIN || BACKEND_ORIGIN;
};

const getStoredAccessToken = () => (isBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null);
const getStoredRefreshToken = () => (isBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null);

export const clearSessionTokens = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const clearStoredTokens = clearSessionTokens;

const redirectToLogin = () => {
  if (!isBrowser()) return;
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/admin/login") || path.startsWith("/activate")) return;
  const isAdminRoute = path.startsWith("/admin");
  window.location.href = isAdminRoute ? "/admin/login" : "/login";
};

const redirectToUnauthorized = () => {
  if (!isBrowser()) return;
  if (window.location.pathname === "/unauthorized") return;
  window.location.href = "/unauthorized";
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

/** Non-critical calls: a 401 must not force a global logout redirect. */
const isSoftAuthFailurePath = (url: string) => url.includes("/notifications");

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const payload: RefreshTokenPayload = { refresh_token: refreshToken };
    const response = await refreshClient.post<RefreshTokenResponse>("/auth/refresh", payload);
    const newToken = response.data.access_token;
    if (!newToken) return null;

    if (isBrowser()) {
      localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
    }
    return newToken;
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const requestConfig = error.config as RetryableAxiosRequestConfig | undefined;
    const requestUrl = requestConfig?.url ?? "";
    const isAuthRequest = requestUrl.startsWith("/auth/");

    if (status === 401 && isBrowser()) {
      const hasAccessToken = Boolean(getStoredAccessToken());
      const hasRefreshToken = Boolean(getStoredRefreshToken());
      const softFailure = isSoftAuthFailurePath(requestUrl);

      const forceLogout = () => {
        if (softFailure) return;
        if (hasAccessToken || hasRefreshToken) {
          clearStoredTokens();
          redirectToLogin();
        }
      };

      if (!requestConfig) {
        return Promise.reject(error);
      }

      if (requestConfig._retry) {
        forceLogout();
        return Promise.reject(error);
      }

      if (!hasRefreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      if (!hasAccessToken && isAuthRequest) {
        return Promise.reject(error);
      }

      requestConfig._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (!newAccessToken) {
        forceLogout();
        return Promise.reject(error);
      }

      requestConfig.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(requestConfig);
    }

    // Do not auto-redirect on 403 — optional dashboard calls may fail without invalidating the session.

    return Promise.reject(error);
  }
);

export default api;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asMessage = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
};

export function getApiStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
}

export function isApiStatus(error: unknown, status: number): boolean {
  return getApiStatus(error) === status;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Erreur de communication avec le serveur."
): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;

  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "La requête a expiré. Le serveur met trop de temps à répondre (voix / IA).";
    }
    return `Impossible de joindre le serveur (${resolveDirectBackendOrigin()}). Lancez le backend : docker compose up -d db backend — puis rechargez la page.`;
  }

  const data = error.response?.data;
  if (!isObject(data)) return fallback;

  const detail = data.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (isObject(first) && typeof first.msg === "string" && first.msg.trim()) {
      return first.msg;
    }
  }

  return asMessage(data.message, fallback);
}

const buildPathWithQuery = (
  path: string,
  query: Record<string, string | number | boolean | undefined | null>
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
};

const toFormData = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
};

const toWsOrigin = (origin: string) =>
  origin.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");

/** WebSocket must reach the API host the browser can open (not the Next.js HTTP proxy). */
export const resolveNotificationsWsOrigin = (): string => {
  const wsOverride = process.env.NEXT_PUBLIC_NOTIFICATIONS_WS_ORIGIN?.trim();
  if (wsOverride) {
    return trimTrailingSlashes(wsOverride.replace(/^ws:\/\//i, "http://").replace(/^wss:\/\//i, "https://"));
  }
  return resolveDirectBackendOrigin();
};

type MizanRequestConfig = AxiosRequestConfig & {
  /** Bypass Next dev proxy for long-running calls (e.g. voice TTS). */
  directBackend?: boolean;
};

const resolveRequestConfig = (config: MizanRequestConfig): AxiosRequestConfig => {
  if (!config.directBackend || !API_USES_PROXY || !isBrowser()) {
    return config;
  }
  const { directBackend: _directBackend, ...rest } = config;
  return {
    ...rest,
    baseURL: `${resolveDirectBackendOrigin()}${API_PREFIX}`,
    timeout: rest.timeout ?? 120_000,
  };
};

const request = async <T>(config: MizanRequestConfig): Promise<T> => {
  const response = await api.request<T>(resolveRequestConfig(config));
  return response.data;
};

const requestRoot = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await axios.request<T>({
    baseURL: resolveDirectBackendOrigin(),
    headers: { Accept: "application/json" },
    ...config,
  });
  return response.data;
};

export const systemApi = {
  health: () => requestRoot<HealthResponse>({ method: "GET", url: "/health" }),
  detailedHealth: () => request<DetailedHealthResponse>({ method: "GET", url: "/health/detailed" }),
};

export const authApi = {
  registerSchool: (payload: SchoolCreatePayload) =>
    request<School>({ method: "POST", url: "/auth/admin/register-school", data: payload }),
  requestActivation: (payload: { email: string }) =>
    request<ApiMessageResponse>({ method: "POST", url: "/auth/request-activation", data: payload }),
  verifyOtp: (payload: VerifyOtpPayload) =>
    request<TempTokenResponse>({ method: "POST", url: "/auth/verify-otp", data: payload }),
  setPassword: (payload: SetPasswordPayload) =>
    request<TokenResponse>({ method: "POST", url: "/auth/set-password", data: payload }),
  forgotPassword: (payload: { email: string }) =>
    request<ApiMessageResponse>({ method: "POST", url: "/auth/forgot-password", data: payload }),
  verifyResetOtp: (payload: VerifyOtpPayload) =>
    request<TempTokenResponse>({ method: "POST", url: "/auth/verify-reset-otp", data: payload }),
  resetPassword: (payload: SetPasswordPayload) =>
    request<TokenResponse>({ method: "POST", url: "/auth/reset-password", data: payload }),
  login: (payload: LoginPayload) =>
    request<TokenResponse>({ method: "POST", url: "/auth/login", data: payload }),
  refresh: (payload: RefreshTokenPayload) =>
    request<RefreshTokenResponse>({ method: "POST", url: "/auth/refresh", data: payload }),
  changePassword: (payload: ChangePasswordPayload) =>
    request<ApiMessageResponse>({ method: "POST", url: "/auth/change-password", data: payload }),
  me: () => request<CurrentUser>({ method: "GET", url: "/auth/me" }),
};

export const institutionalApi = {
  createSchool: (payload: SchoolCreatePayload) =>
    request<School>({ method: "POST", url: "/institutional/schools", data: payload }),
  listSchools: () => request<School[]>({ method: "GET", url: "/institutional/schools" }),
  createFiliere: (payload: FiliereCreatePayload) =>
    request<Filiere>({ method: "POST", url: "/institutional/filieres", data: payload }),
  listFilieresBySchool: (schoolId: string) =>
    request<Filiere[]>({ method: "GET", url: `/institutional/filieres/${schoolId}` }),
  createPromotion: (payload: PromotionCreatePayload) =>
    request<Promotion>({ method: "POST", url: "/institutional/promotions", data: payload }),
  listPromotionsByFiliere: (filiereId: string) =>
    request<Promotion[]>({ method: "GET", url: `/institutional/promotions/${filiereId}` }),
  createClass: (payload: ClassCreatePayload) =>
    request<Class>({ method: "POST", url: "/institutional/classes", data: payload }),
  listClassesByPromotion: (promotionId: string) =>
    request<Class[]>({ method: "GET", url: `/institutional/classes/${promotionId}` }),
};

const uploadCsv = <T>(
  path: string,
  file: File,
  query?: Record<string, string | number | boolean | undefined | null>
) =>
  request<T>({
    method: "POST",
    url: query ? buildPathWithQuery(path, query) : path,
    data: toFormData(file),
    headers: { "Content-Type": "multipart/form-data" },
  });

export const studentsApi = {
  importTrombi: (classId: string, file: File) =>
    uploadCsv<ApiMessageResponse>(`/students/import/trombi/${classId}`, file),
  create: (payload: StudentCreatePayload) =>
    request<Student>({ method: "POST", url: "/students", data: payload }),
  listByClass: (classId: string) =>
    request<Student[]>({ method: "GET", url: `/students/class/${classId}` }),
  update: (studentId: string, payload: StudentUpdatePayload) =>
    request<Student>({ method: "PUT", url: `/students/${studentId}`, data: payload }),
  remove: (studentId: string) =>
    request<ApiMessageResponse>({ method: "DELETE", url: `/students/${studentId}` }),
  me: () => request<Student>({ method: "GET", url: "/students/me" }),
  context: () => request<StudentContext>({ method: "GET", url: "/students/me/context" }),
  mySchedules: () => request<ScheduleEntry[]>({ method: "GET", url: "/students/me/schedules" }),
};

export const classContentApi = {
  listSchedules: (classId: string) =>
    request<ScheduleEntry[]>({ method: "GET", url: `/class-content/${classId}/schedules` }),
  createSchedule: (classId: string, payload: ScheduleCreatePayload) =>
    request<ApiMessageResponse>({ method: "POST", url: `/class-content/${classId}/schedules`, data: payload }),
  syncSchedulesToStudents: (classId: string) =>
    request<ApiMessageResponse & { students?: number; template_slots?: number; rows_added?: number }>({
      method: "POST",
      url: `/class-content/${classId}/schedules/sync-students`,
    }),
  updateSchedule: (classId: string, scheduleId: string, payload: ScheduleUpdatePayload, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "PATCH",
      url: buildPathWithQuery(`/class-content/${classId}/schedules/${scheduleId}`, { apply_to_class: applyToClass }),
      data: payload,
    }),
  deleteSchedule: (classId: string, scheduleId: string, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "DELETE",
      url: buildPathWithQuery(`/class-content/${classId}/schedules/${scheduleId}`, { apply_to_class: applyToClass }),
    }),
  importSchedules: (classId: string, file: File, replaceExisting = false) =>
    uploadCsv<ApiMessageResponse>(`/class-content/${classId}/schedules/import`, file, {
      replace_existing: replaceExisting,
    }),

  listExams: (classId: string) =>
    request<Exam[]>({ method: "GET", url: `/class-content/${classId}/exams` }),
  createExam: (classId: string, payload: ExamCreatePayload) =>
    request<ApiMessageResponse>({ method: "POST", url: `/class-content/${classId}/exams`, data: payload }),
  updateExam: (classId: string, examId: string, payload: ExamUpdatePayload, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "PATCH",
      url: buildPathWithQuery(`/class-content/${classId}/exams/${examId}`, { apply_to_class: applyToClass }),
      data: payload,
    }),
  deleteExam: (classId: string, examId: string, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "DELETE",
      url: buildPathWithQuery(`/class-content/${classId}/exams/${examId}`, { apply_to_class: applyToClass }),
    }),
  importExams: (classId: string, file: File, replaceExisting = false) =>
    uploadCsv<ApiMessageResponse>(`/class-content/${classId}/exams/import`, file, {
      replace_existing: replaceExisting,
    }),

  listProjects: (classId: string) =>
    request<Project[]>({ method: "GET", url: `/class-content/${classId}/projects` }),
  createProject: (classId: string, payload: ProjectCreatePayload) =>
    request<ApiMessageResponse>({ method: "POST", url: `/class-content/${classId}/projects`, data: payload }),
  updateProject: (classId: string, projectId: string, payload: ProjectUpdatePayload, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "PATCH",
      url: buildPathWithQuery(`/class-content/${classId}/projects/${projectId}`, { apply_to_class: applyToClass }),
      data: payload,
    }),
  deleteProject: (classId: string, projectId: string, applyToClass = true) =>
    request<ApiMessageResponse>({
      method: "DELETE",
      url: buildPathWithQuery(`/class-content/${classId}/projects/${projectId}`, { apply_to_class: applyToClass }),
    }),
  importProjects: (classId: string, file: File, replaceExisting = false) =>
    uploadCsv<ApiMessageResponse>(`/class-content/${classId}/projects/import`, file, {
      replace_existing: replaceExisting,
    }),
};

export const checkinsApi = {
  morningBriefing: () => request<MorningBriefing>({ method: "GET", url: "/checkins/morning/briefing" }),
  questions: (period: CheckinPeriod, mode: CheckinQuestionMode) =>
    request<PersonalizedCheckinQuestionsResponse>({
      method: "GET",
      url: buildPathWithQuery("/checkins/questions", { period, mode }),
    }),
  createMorning: (payload: MorningCheckinCreatePayload) =>
    request<MorningCheckinResponse>({ method: "POST", url: "/checkins/morning", data: payload }),
  createEvening: (payload: EveningCheckinCreatePayload) =>
    request<EveningCheckinResponse>({ method: "POST", url: "/checkins/evening", data: payload }),
  history: (days = 7) =>
    request<CheckinHistoryResponse>({
      method: "GET",
      url: buildPathWithQuery("/checkins/history", { days }),
    }),
};

export const goalsApi = {
  list: () => request<Goal[]>({ method: "GET", url: "/goals" }),
  create: (payload: GoalCreatePayload) => request<Goal>({ method: "POST", url: "/goals", data: payload }),
  today: () => request<GoalTodaySummary[]>({ method: "GET", url: "/goals/today" }),
  getById: (goalId: string) => request<GoalWithProgress>({ method: "GET", url: `/goals/${goalId}` }),
  logProgress: (payload: GoalProgressCreatePayload) =>
    request<GoalProgress>({ method: "POST", url: "/goals/progress", data: payload }),
  deactivate: (goalId: string) => request<ApiMessageResponse>({ method: "DELETE", url: `/goals/${goalId}` }),
};

export const tasksApi = {
  list: (params?: { status?: TaskStatus; due_date?: string }) =>
    request<Task[]>({ method: "GET", url: buildPathWithQuery("/tasks", params ?? {}) }),
  create: (payload: { title: string; description?: string; due_date?: string; source?: "manual" | "chat" | "voice_chat" | "morning_checkin" }) =>
    request<Task>({ method: "POST", url: "/tasks", data: payload }),
  createMany: (payload: TaskBulkCreatePayload) =>
    request<Task[]>({ method: "POST", url: "/tasks/bulk", data: payload }),
  updateStatus: (taskId: string, status: TaskStatus) =>
    request<Task>({ method: "PATCH", url: `/tasks/${taskId}`, data: { status } }),
  update: (taskId: string, payload: TaskUpdatePayload) =>
    request<Task>({ method: "PUT", url: `/tasks/${taskId}`, data: payload }),
  remove: (taskId: string) =>
    request<ApiMessageResponse>({ method: "DELETE", url: `/tasks/${taskId}` }),
  completeMany: (taskIds: string[]) =>
    request<{ updated_count: number }>({ method: "POST", url: "/tasks/complete-many", data: { task_ids: taskIds } }),
  suggestFromChat: (payload: { user_message: string; assistant_message: string }) =>
    request<ChatTaskSuggestionResponse>({ method: "POST", url: "/tasks/suggest-from-chat", data: payload }),
};

export const modesApi = {
  start: (mode: ModeSession["mode"]) => request<ModeSession>({ method: "POST", url: "/modes/start", data: { mode } }),
  stop: () => request<ModeSession>({ method: "POST", url: "/modes/stop" }),
  current: () => request<ModeSession | null>({ method: "GET", url: "/modes/current" }),
  stats: () => request<ModeStats>({ method: "GET", url: "/modes/stats" }),
};

export const analyticsApi = {
  dashboard: () => request<StudentDashboard>({ method: "GET", url: "/analytics/dashboard" }),
  mood: (days = 30) => request<MoodGraphPoint[]>({ method: "GET", url: buildPathWithQuery("/analytics/mood", { days }) }),
  modes: (days = 7) => request<WeeklyReport["mode_distribution"]>({
    method: "GET",
    url: buildPathWithQuery("/analytics/modes", { days }),
  }),
  weeklyReport: () => request<WeeklyReport>({ method: "GET", url: "/analytics/weekly-report" }),
  adminDashboard: () => request<AdminDashboardResponse>({ method: "GET", url: "/analytics/admin/dashboard" }),
};

export const voiceApi = {
  start: (period: VoicePeriod) =>
    request<VoiceSessionResponse>({
      method: "POST",
      url: "/voice/start",
      data: { period },
      directBackend: true,
      timeout: 120_000,
    }),
  transcribe: (file: File) =>
    request<VoiceTranscribeResponse>({
      method: "POST",
      url: "/voice/transcribe",
      data: toFormData(file),
      headers: { "Content-Type": "multipart/form-data" },
      directBackend: true,
      timeout: 120_000,
    }),
  submit: (payload: VoiceSessionSubmitPayload) =>
    request<VoiceAnalysis>({ method: "POST", url: "/voice/submit", data: payload }),
  chat: (payload: VoiceChatRequest) =>
    request<VoiceChatResponse>({
      method: "POST",
      url: "/voice/chat",
      data: payload,
      timeout: 90000,
    }),
};

export const resourcesApi = {
  list: () => request<Resource[]>({ method: "GET", url: "/resources" }),
  getForMe: () => request<Resource[]>({ method: "GET", url: "/resources/for-me" }),
  create: (payload: ResourceCreatePayload) => request<Resource>({ method: "POST", url: "/resources", data: payload }),
  update: (id: string, payload: ResourceUpdatePayload) => request<Resource>({ method: "PUT", url: `/resources/${id}`, data: payload }),
  remove: (id: string) => request<ApiMessageResponse>({ method: "DELETE", url: `/resources/${id}` }),
  seed: () => request<ApiMessageResponse>({ method: "POST", url: "/resources/seed" }),
};

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) =>
    request<Notification[]>({ method: "GET", url: buildPathWithQuery("/notifications", params ?? {}) }),
  markRead: (notificationId: string, is_read = true) =>
    request<Notification>({
      method: "PATCH",
      url: `/notifications/${notificationId}/read`,
      data: { is_read },
    }),
  readAll: () =>
    request<{ updated_count: number }>({
      method: "POST",
      url: "/notifications/read-all",
    }),
  realtimeUrl: () => {
    const token = getStoredAccessToken();
    if (!token) return null;
    const wsOrigin = toWsOrigin(resolveNotificationsWsOrigin());
    return `${wsOrigin}${API_PREFIX}/notifications/ws?token=${encodeURIComponent(token)}`;
  },
};

export const filesApi = {
  uploadStudentPhoto: (studentId: string, file: File) =>
    request<PhotoUploadResponse>({
      method: "POST",
      url: `/files/students/${studentId}/photo`,
      data: toFormData(file),
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteStudentPhoto: (studentId: string) =>
    request<ApiMessageResponse>({ method: "DELETE", url: `/files/students/${studentId}/photo` }),
  uploadMyPhoto: (file: File) =>
    request<PhotoUploadResponse>({
      method: "POST",
      url: "/files/me/photo",
      data: toFormData(file),
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteMyPhoto: () => request<ApiMessageResponse>({ method: "DELETE", url: "/files/me/photo" }),
};

export const agentApi = {
  context: () => request<Record<string, unknown>>({ method: "GET", url: "/agent/context" }),
  plan: (payload: AgentPlanPayload) =>
    request<AgentPlanResponse>({ method: "POST", url: "/agent/plan", data: payload }),
  chat: (message: string, history: AgentChatMessage[] = []) =>
    request<AgentChatResponse>({
      method: "POST",
      url: "/agent/chat",
      data: { message, history: history.slice(-24) },
    }),
  listContracts: (params?: { status?: string; limit?: number }) =>
    request<AgentActionContract[]>({
      method: "GET",
      url: buildPathWithQuery("/agent/contracts", params ?? {}),
    }),
  respondContract: (
    contractId: string,
    accepted: boolean,
    options?: { declineReason?: string }
  ) =>
    request<AgentActionContract>({
      method: "POST",
      url: `/agent/contracts/${contractId}/respond`,
      data: { accepted, decline_reason: options?.declineReason ?? null },
    }),
  completeContract: (contractId: string, options?: { fromPending?: boolean }) =>
    request<AgentActionContract>({
      method: "POST",
      url: `/agent/contracts/${contractId}/complete`,
      data: { from_pending: options?.fromPending ?? false },
    }),
};

export const globalApi = {
  listPendingSchools: () =>
    request<School[]>({ method: "GET", url: "/global/verify/schools" }),
  verifySchool: (schoolId: string, status: "VERIFIED" | "REJECTED", note?: string) =>
    request<School>({
      method: "POST",
      url: `/global/verify/schools/${schoolId}`,
      data: { status, note },
    }),
  listSchools: () =>
    request<School[]>({ method: "GET", url: "/global/schools" }),
  deleteSchool: (schoolId: string) =>
    request<ApiMessageResponse>({ method: "DELETE", url: `/global/schools/${schoolId}` }),
  toggleSchoolActive: (schoolId: string, isActive: boolean) =>
    request<School>({
      method: "PATCH",
      url: `/global/schools/${schoolId}/active`,
      params: { is_active: isActive },
    }),
};
