import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Activate: undefined;
  VerifyOtp: { email: string };
  SetPassword: { tempToken: string };
  ForgotPassword: undefined;
  VerifyResetOtp: { email: string };
  ResetPassword: { tempToken: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Checkin: undefined;
  AgentChatTab: undefined;
  Tasks: { highlightTaskId?: string } | undefined;
  More: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  MorningCheckin: undefined;
  EveningCheckin: undefined;
  VoiceCheckin: { period?: "MORNING" | "EVENING" } | undefined;
  NewGoal: undefined;
  GoalDetails: { goalId: string };
  Modes: undefined;
  Resources: undefined;
  Notifications: undefined;
  Profile: undefined;
  AgentChat: undefined;
  AgentContracts: { highlight?: string } | undefined;
  History: undefined;
  WeeklyReport: undefined;
  Goals: undefined;
  ScheduleWeek: undefined;
};
