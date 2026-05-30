export type TabKey = "Dashboard" | "Checkin" | "AgentChatTab" | "Tasks" | "More";

export type Nav = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  switchTab?: (tab: TabKey) => void;
};
