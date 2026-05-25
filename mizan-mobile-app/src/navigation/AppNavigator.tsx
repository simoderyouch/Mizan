import React, { useCallback, useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  Bell,
  CheckSquare,
  Home,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Target,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/ui";
import { notificationsApi } from "../lib/api";
import { showLocalNotification, setBadgeCount } from "../lib/notifications";
import { API_ORIGIN, tokenStore } from "../lib/api";
import { colors, radius, shadow, spacing } from "../theme";
import type { AuthStackParamList, MainStackParamList } from "./types";
import {
  ActivateScreen,
  LoginScreen,
  SetPasswordScreen,
  VerifyOtpScreen,
} from "../screens/AuthScreens";
import {
  AgentChatScreen,
  AgentContractsScreen,
  AgentScenariosScreen,
  CheckinHubScreen,
  DashboardScreen,
  EveningCheckinScreen,
  GoalDetailsScreen,
  GoalsScreen,
  HistoryScreen,
  ModesScreen,
  MoreScreen,
  MorningCheckinScreen,
  NewGoalScreen,
  NotificationsScreen,
  ProfileScreen,
  ResourcesScreen,
  TasksScreen,
  VoiceCheckinScreen,
  WeeklyReportScreen,
} from "../screens/MainScreens";

const icon = require("../../assets/MIZAN_ICON.png");

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
  },
};

function Splash() {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center" }}>
      <Image source={icon} style={{ height: 72, marginBottom: 18, width: 72 }} />
      <LoadingState label="Ouverture de Mizan..." />
    </View>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Activate" component={ActivateScreen} />
      <AuthStack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
      <AuthStack.Screen name="SetPassword" component={SetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ── New tab layout: Home | Rituel | AI Chat | Tâches | Plus ──
const tabs = [
  { key: "Dashboard", label: "Accueil", icon: Home, component: DashboardScreen },
  { key: "Checkin", label: "Rituel", icon: Mic, component: CheckinHubScreen },
  { key: "AgentChatTab", label: "Mizan AI", icon: MessageCircle, component: AgentChatScreen },
  { key: "Tasks", label: "Tâches", icon: CheckSquare, component: TasksScreen },
  { key: "More", label: "Plus", icon: MoreHorizontal, component: MoreScreen },
] as const;

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.text}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

function TabsNavigator({
  navigation,
}: {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}) {
  const [activeTab, setActiveTab] = React.useState<(typeof tabs)[number]["key"]>("Dashboard");
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const activeConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const ActiveScreen = activeConfig.component;



  // Poll for unread notifications every 30s
  const fetchUnread = useCallback(async () => {
    try {
      const items = await notificationsApi.list({ unread_only: true, limit: 100 });
      const count = items.filter((n) => !n.is_read).length;
      setUnreadCount(count);
      void setBadgeCount(count);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    void fetchUnread();
    const interval = setInterval(() => void fetchUnread(), 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // WebSocket for real-time notifications
  useEffect(() => {
    let ws: WebSocket | null = null;
    let active = true;

    const connect = async () => {
      const token = await tokenStore.getAccessToken();
      if (!token || !active) return;
      const wsOrigin = API_ORIGIN.replace(/^http/, "ws");
      const wsUrl = `${wsOrigin}/api/v1/notifications/ws?token=${token}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.title) {
            void showLocalNotification(data.title, data.body ?? "", data.payload);
            setUnreadCount((prev) => prev + 1);
          }
        } catch {
          // ignore parse errors
        }
      };
      ws.onclose = () => {
        if (active) setTimeout(connect, 5000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    void connect();
    return () => {
      active = false;
      ws?.close();
    };
  }, []);

  return (
    <View style={styles.tabScene}>
      <View style={styles.activeScreenWrap}>
        <ActiveScreen navigation={navigation} unreadCount={unreadCount} />
      </View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const focused = tab.key === activeTab;
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => [
                  styles.tabButton,
                  focused && styles.tabButtonActive,
                  pressed && styles.tabButtonPressed,
                ]}
              >
                <Icon color={focused ? colors.onPrimary : colors.muted} size={20} />
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerBackTitle: "Retour",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitle: ({ children }) => (
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{children}</Text>
        ),
      }}
    >
      <MainStack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
      <MainStack.Screen name="MorningCheckin" component={MorningCheckinScreen} options={{ title: "Matin" }} />
      <MainStack.Screen name="EveningCheckin" component={EveningCheckinScreen} options={{ title: "Soir" }} />
      <MainStack.Screen name="VoiceCheckin" component={VoiceCheckinScreen} options={{ title: "Vocal" }} />
      <MainStack.Screen name="NewGoal" component={NewGoalScreen} options={{ title: "Nouvel objectif" }} />
      <MainStack.Screen name="GoalDetails" component={GoalDetailsScreen} options={{ title: "Objectif" }} />
      <MainStack.Screen name="Modes" component={ModesScreen} options={{ title: "Modes" }} />
      <MainStack.Screen name="Resources" component={ResourcesScreen} options={{ title: "Ressources" }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
      <MainStack.Screen name="AgentChat" component={AgentChatScreen} options={{ title: "Mizan AI" }} />
      <MainStack.Screen name="AgentContracts" component={AgentContractsScreen} options={{ title: "Contrats" }} />
      <MainStack.Screen name="AgentScenarios" component={AgentScenariosScreen} options={{ title: "Scénarios" }} />
      <MainStack.Screen name="History" component={HistoryScreen} options={{ title: "Historique" }} />
      <MainStack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: "Rapport" }} />
      <MainStack.Screen name="Goals" component={GoalsScreen} options={{ title: "Objectifs" }} />
    </MainStack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Splash />;
  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderColor: colors.onPrimary,
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: "absolute",
    right: -6,
    top: -6,
  },
  text: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: "900",
  },
});

const styles = StyleSheet.create({
  tabScene: {
    backgroundColor: colors.background,
    flex: 1,
    flexDirection: "column",
  },
  activeScreenWrap: {
    flex: 1,
  },
  tabBarWrap: {
    backgroundColor: colors.surface,
    borderTopColor: "rgba(194, 198, 211, 0.18)",
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    gap: 3,
    minHeight: 52,
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  tabLabelActive: {
    color: colors.onPrimary,
  },
});
