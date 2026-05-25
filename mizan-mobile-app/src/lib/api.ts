import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type {
  AgentActionContract,
  AgentChatResponse,
  AgentTestRun,
  AgentTestTriggerPayload,
  AgentTestTriggerResponse,
  ApiErrorResponse,
  ApiMessageResponse,
  CheckinHistoryResponse,
  CheckinPeriod,
  CheckinQuestionMode,
  ChatTaskSuggestionResponse,
  ChangePasswordPayload,
  CurrentUser,
  DetailedHealthResponse,
  EveningCheckinCreatePayload,
  EveningCheckinResponse,
  Goal,
  GoalCreatePayload,
  GoalProgress,
  GoalProgressCreatePayload,
  GoalTodaySummary,
  GoalWithProgress,
  LoginPayload,
  ModeSession,
  ModeStats,
  MorningBriefing,
  MorningCheckinCreatePayload,
  MorningCheckinResponse,
  Notification,
  PersonalizedCheckinQuestionsResponse,
  PhotoUploadResponse,
  RefreshTokenPayload,
  RefreshTokenResponse,
  Resource,
  Student,
  StudentContext,
  StudentDashboard,
  Task,
  TaskStatus,
  TempTokenResponse,
  TokenResponse,
  VerifyOtpPayload,
  VoicePeriod,
  VoiceSessionResponse,
  VoiceSessionSubmitPayload,
  VoiceAnalysis,
  VoiceTranscribeResponse,
  VoiceChatResponse,
  WeeklyReport,
} from "./types";

const API_PREFIX = "/api/v1";
const DEFAULT_API_ORIGIN_FALLBACK =
  Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
const ACCESS_TOKEN_KEY = "mizan_access_token";
const REFRESH_TOKEN_KEY = "mizan_refresh_token";

export type NativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const getExpoDebuggerHost = () => {
  const expoGoConfig = (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig;
  const expoConfig = (Constants as unknown as { expoConfig?: { hostUri?: string } }).expoConfig;
  return expoGoConfig?.debuggerHost ?? expoConfig?.hostUri ?? null;
};

const resolveDefaultApiOrigin = () => {
  const fallback = trimTrailingSlashes(DEFAULT_API_ORIGIN_FALLBACK);
  const host = getExpoDebuggerHost()?.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return fallback;
  return `http://${host}:8000`;
};

const toApiOrigin = (raw: string | undefined): string => {
  const fallback = resolveDefaultApiOrigin();
  const candidate = raw ? trimTrailingSlashes(raw.trim()) : fallback;
  if (!candidate || candidate.startsWith("/")) return fallback;
  if (candidate.endsWith(API_PREFIX)) {
    const stripped = candidate.slice(0, -API_PREFIX.length);
    return stripped || fallback;
  }
  return candidate;
};

const buildPathWithQuery = (
  path: string,
  params: Record<string, string | number | boolean | undefined | null>
) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${path}?${query}` : path;
};

const toFormData = async (file: NativeUploadFile) => {
  const formData = new FormData();
  if (Platform.OS === "web") {
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      formData.append("file", blob, file.name);
    } catch (e) {
      console.warn("Failed to fetch blob on web, falling back to raw object", e);
      formData.append("file", file as unknown as Blob);
    }
  } else {
    formData.append("file", file as unknown as Blob);
  }
  return formData;
};

export const API_ORIGIN = toApiOrigin(process.env.EXPO_PUBLIC_API_URL);
export const API_BASE_URL = `${API_ORIGIN}${API_PREFIX}`;

let onAuthFailure: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const setAuthFailureHandler = (handler: (() => void) | null) => {
  onAuthFailure = handler;
};

const webStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  deleteItem: (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

const secureStorage = {
  getItem: (key: string) =>
    Platform.OS === "web" ? Promise.resolve(webStorage.getItem(key)) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === "web" ? Promise.resolve(webStorage.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) =>
    Platform.OS === "web" ? Promise.resolve(webStorage.deleteItem(key)) : SecureStore.deleteItemAsync(key),
};

export const tokenStore = {
  getAccessToken: () => secureStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => secureStorage.getItem(REFRESH_TOKEN_KEY),
  setAccessToken: (token: string) => secureStorage.setItem(ACCESS_TOKEN_KEY, token),
  setTokens: async (tokens: TokenResponse) => {
    await secureStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    await secureStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },
  clear: async () => {
    await secureStorage.deleteItem(ACCESS_TOKEN_KEY);
    await secureStorage.deleteItem(REFRESH_TOKEN_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
  timeout: 30000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const payload: RefreshTokenPayload = { refresh_token: refreshToken };
    const response = await refreshClient.post<RefreshTokenResponse>("/auth/refresh", payload);
    const newToken = response.data.access_token;
    if (!newToken) return null;
    await tokenStore.setAccessToken(newToken);
    return newToken;
  } catch {
    return null;
  }
};

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccessToken();
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

    if (status === 401) {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!requestConfig || requestConfig._retry || !refreshToken) {
        await tokenStore.clear();
        onAuthFailure?.();
        return Promise.reject(error);
      }

      if (isAuthRequest) return Promise.reject(error);

      requestConfig._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (!newAccessToken) {
        await tokenStore.clear();
        onAuthFailure?.();
        return Promise.reject(error);
      }

      requestConfig.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(requestConfig);
    }

    return Promise.reject(error);
  }
);

const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await api.request<T>(config);
  return response.data;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function getApiErrorMessage(
  error: unknown,
  fallback = "Erreur de communication avec le serveur."
): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback;
  const data = error.response?.data;
  if (!isObject(data)) return fallback;
  const detail = data.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (isObject(first) && typeof first.msg === "string" && first.msg.trim()) return first.msg;
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

export const authApi = {
  requestActivation: (payload: { email: string }) =>
    request<ApiMessageResponse>({ method: "POST", url: "/auth/request-activation", data: payload }),
  verifyOtp: (payload: VerifyOtpPayload) =>
    request<TempTokenResponse>({ method: "POST", url: "/auth/verify-otp", data: payload }),
  setPassword: (payload: { token: string; new_password: string }) =>
    request<TokenResponse>({ method: "POST", url: "/auth/set-password", data: payload }),
  login: (payload: LoginPayload) =>
    request<TokenResponse>({ method: "POST", url: "/auth/login", data: payload }),
  changePassword: (payload: ChangePasswordPayload) =>
    request<ApiMessageResponse>({ method: "POST", url: "/auth/change-password", data: payload }),
  me: () => request<CurrentUser>({ method: "GET", url: "/auth/me" }),
};

export const healthApi = {
  detailed: () => request<DetailedHealthResponse>({ method: "GET", url: "/health/detailed" }),
};

export const studentsApi = {
  me: () => request<Student>({ method: "GET", url: "/students/me" }),
  context: () => request<StudentContext>({ method: "GET", url: "/students/me/context" }),
};

export const analyticsApi = {
  dashboard: () => request<StudentDashboard>({ method: "GET", url: "/analytics/dashboard" }),
  weeklyReport: () => request<WeeklyReport>({ method: "GET", url: "/analytics/weekly-report" }),
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
    request<Task[]>({ method: "GET", url: buildPathWithQuery("/tasks/", params ?? {}) }),
  create: (payload: { title: string; description?: string; due_date?: string; source?: "manual" | "chat" | "voice_chat" | "morning_checkin" | "agent" }) =>
    request<Task>({ method: "POST", url: "/tasks/", data: payload }),
  createMany: (payload: { tasks: Array<{ title: string; description?: string; due_date?: string; source?: string }> }) =>
    request<Task[]>({ method: "POST", url: "/tasks/bulk", data: payload }),
  updateStatus: (taskId: string, status: TaskStatus) =>
    request<Task>({ method: "PATCH", url: `/tasks/${taskId}`, data: { status } }),
  update: (taskId: string, payload: { title?: string; description?: string; due_date?: string }) =>
    request<Task>({ method: "PUT", url: `/tasks/${taskId}`, data: payload }),
  remove: (taskId: string) => request<ApiMessageResponse>({ method: "DELETE", url: `/tasks/${taskId}` }),
  suggestFromChat: (payload: { user_message: string; assistant_message: string }) =>
    request<ChatTaskSuggestionResponse>({ method: "POST", url: "/tasks/suggest-from-chat", data: payload }),
};

export const modesApi = {
  start: (mode: ModeSession["mode"]) => request<ModeSession>({ method: "POST", url: "/modes/start", data: { mode } }),
  stop: () => request<ModeSession>({ method: "POST", url: "/modes/stop" }),
  current: () => request<ModeSession | null>({ method: "GET", url: "/modes/current" }),
  stats: () => request<ModeStats>({ method: "GET", url: "/modes/stats" }),
};

export const resourcesApi = {
  list: () => request<Resource[]>({ method: "GET", url: "/resources" }),
  getForMe: () => request<Resource[]>({ method: "GET", url: "/resources/for-me" }),
};

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) =>
    request<Notification[]>({ method: "GET", url: buildPathWithQuery("/notifications/", params ?? {}) }),
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
};

export const filesApi = {
  uploadMyPhoto: async (file: NativeUploadFile) =>
    request<PhotoUploadResponse>({
      method: "POST",
      url: "/files/me/photo",
      data: await toFormData(file),
    }),
  deleteMyPhoto: () => request<ApiMessageResponse>({ method: "DELETE", url: "/files/me/photo" }),
};

export const voiceApi = {
  start: (period: VoicePeriod) =>
    request<VoiceSessionResponse>({ method: "POST", url: "/voice/start", data: { period } }),
  transcribe: async (file: NativeUploadFile) =>
    request<VoiceTranscribeResponse>({
      method: "POST",
      url: "/voice/transcribe",
      data: await toFormData(file),
      timeout: 30000,
    }),
  submit: (payload: VoiceSessionSubmitPayload) =>
    request<VoiceAnalysis>({ method: "POST", url: "/voice/submit", data: payload, timeout: 45000 }),
  chat: (payload: { user_text: string; history: Array<{ role: "user" | "assistant"; content: string }> }) =>
    request<VoiceChatResponse>({ method: "POST", url: "/voice/chat", data: payload, timeout: 45000 }),
};

export const agentApi = {
  chat: (message: string) => request<AgentChatResponse>({ method: "POST", url: "/agent/chat", data: { message } }),
  listContracts: (params?: { status?: string; limit?: number }) =>
    request<AgentActionContract[]>({
      method: "GET",
      url: buildPathWithQuery("/agent/contracts", params ?? {}),
    }),
  respondContract: (contractId: string, accepted: boolean) =>
    request<AgentActionContract>({
      method: "POST",
      url: `/agent/contracts/${contractId}/respond`,
      data: { accepted },
    }),
  completeContract: (contractId: string) =>
    request<AgentActionContract>({ method: "POST", url: `/agent/contracts/${contractId}/complete` }),
  listTestRuns: (limit = 20) =>
    request<AgentTestRun[]>({ method: "GET", url: buildPathWithQuery("/agent/test/runs", { limit }) }),
  triggerTestRun: (payload: AgentTestTriggerPayload) =>
    request<AgentTestTriggerResponse>({ method: "POST", url: "/agent/test/trigger", data: payload }),
};
