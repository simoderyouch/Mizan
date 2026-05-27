import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Activate: undefined;
  VerifyOtp: { email: string };
  SetPassword: { tempToken: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Checkin: undefined;
  AgentChatTab: undefined;
  Tasks: undefined;
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
  AgentContracts: undefined;
  AgentScenarios: undefined;
  History: undefined;
  WeeklyReport: undefined;
  Goals: undefined;
};
