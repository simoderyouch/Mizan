import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme, RouteProp, useRoute } from "@react-navigation/native";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CheckSquare,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "../components/ui";
import { notificationsApi } from "../lib/api";
import { parseWsPacket } from "../lib/notification-realtime";
import { showLocalNotification, setBadgeCount } from "../lib/notifications";
import { API_ORIGIN, tokenStore } from "../lib/api";
import { colors, radius, shadow, spacing } from "../theme";
import type { AuthStackParamList, MainStackParamList } from "./types";
import type { Nav } from "../screens/student/types";
import {
  ActivateScreen,
  ForgotPasswordScreen,
  LoginScreen,
  ResetPasswordScreen,
  SetPasswordScreen,
  VerifyOtpScreen,
  VerifyResetOtpScreen,
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
  ScheduleWeekScreen,
} from "../screens/student";

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
      <LoadingState label="Opening Mizan..." />
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
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="VerifyResetOtp" component={VerifyResetOtpScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ── Tab layout: Home | Ritual | AI Chat | Tasks | More ──
const tabs = [
  { key: "Dashboard", label: "Home", icon: Home, component: DashboardScreen },
  { key: "Checkin", label: "Wellbeing", icon: Heart, component: CheckinHubScreen },
  { key: "AgentChatTab", label: "Mizan AI", icon: MessageCircle, component: AgentChatScreen },
  { key: "Tasks", label: "Tasks", icon: CheckSquare, component: TasksScreen },
  { key: "More", label: "More", icon: MoreHorizontal, component: MoreScreen },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function isTabKey(value: string): value is TabKey {
  return tabs.some((tab) => tab.key === value);
}

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
  navigation: NativeStackNavigationProp<MainStackParamList, "Tabs">;
}) {
  const route = useRoute<RouteProp<MainStackParamList, "Tabs">>();
  const [activeTab, setActiveTab] = React.useState<TabKey>("Dashboard");
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const activeConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const ActiveScreen = activeConfig.component;
  const wsRef = useRef<WebSocket | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  // ── Phase 3: Single notification strategy ──
  // Poll every 60s (reduced from 30s) + WS with proper lifecycle
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
    const interval = setInterval(() => void fetchUnread(), 60_000); // Phase 3: 60s instead of 30s
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // ── Phase 3: WebSocket with AppState lifecycle ──
  // Close WS on background, single reconnect on foreground
  const connectWs = useCallback(async () => {
    // Close existing connection first
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const token = await tokenStore.getAccessToken();
    if (!token) return;
    const wsOrigin = API_ORIGIN.replace(/^http/, "ws");
    const wsUrl = `${wsOrigin}/api/v1/notifications/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const packet = parseWsPacket(JSON.parse(event.data));
        if (!packet) return;

        if (packet.type === "notification.snapshot") {
          void fetchUnread();
          return;
        }

        if (packet.type === "notification.all_read") {
          setUnreadCount(0);
          void setBadgeCount(0);
          return;
        }

        if (packet.type === "notification.created") {
          if (seenNotificationIdsRef.current.has(packet.notification.id)) return;
          seenNotificationIdsRef.current.add(packet.notification.id);
          void showLocalNotification(
            packet.notification.title,
            packet.notification.body,
            packet.notification.payload ?? undefined
          );
          void fetchUnread();
          return;
        }

        if (packet.type === "legacy") {
          void showLocalNotification(packet.title, packet.body, packet.payload);
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // ignore parse errors
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
      // Phase 3: No aggressive reconnect — wait for foreground event or next poll
    };
    ws.onerror = () => {
      ws.close();
    };
  }, [fetchUnread]);

  useEffect(() => {
    void connectWs();

    // Phase 3: AppState-driven WS lifecycle
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        // App came to foreground — single reconnect + fetch
        void connectWs();
        void fetchUnread();
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background — close WS
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
          wsRef.current = null;
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs, fetchUnread]);

  const switchTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const requested = route.params?.screen;
    if (requested && isTabKey(requested)) {
      setActiveTab(requested);
    }
  }, [route.params?.screen]);

  const tabNavigation = React.useMemo(
    () => ({
      navigate: navigation.navigate.bind(navigation) as Nav["navigate"],
      goBack: navigation.goBack.bind(navigation),
      switchTab,
    }),
    [navigation, switchTab]
  );

  return (
    <View style={styles.tabScene}>
      <View style={styles.activeScreenWrap}>
        <ActiveScreen navigation={tabNavigation} unreadCount={unreadCount} />
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
        headerBackTitle: "Back",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitle: ({ children }) => (
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{children}</Text>
        ),
      }}
    >
      <MainStack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
      <MainStack.Screen name="MorningCheckin" component={MorningCheckinScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="EveningCheckin" component={EveningCheckinScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="VoiceCheckin" component={VoiceCheckinScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="NewGoal" component={NewGoalScreen} options={{ title: "New goal" }} />
      <MainStack.Screen name="GoalDetails" component={GoalDetailsScreen} options={{ title: "Goal" }} />
      <MainStack.Screen name="Modes" component={ModesScreen} options={{ title: "Modes" }} />
      <MainStack.Screen name="Resources" component={ResourcesScreen} options={{ title: "Resources" }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <MainStack.Screen name="AgentChat" component={AgentChatScreen} options={{ headerShown: false }} />
      <MainStack.Screen name="AgentContracts" component={AgentContractsScreen} options={{ title: "Commitments" }} />
      <MainStack.Screen name="AgentScenarios" component={AgentScenariosScreen} options={{ title: "Scenarios" }} />
      <MainStack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
      <MainStack.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: "Report" }} />
      <MainStack.Screen name="Goals" component={GoalsScreen} options={{ title: "Goals" }} />
      <MainStack.Screen name="ScheduleWeek" component={ScheduleWeekScreen} options={{ title: "Schedule" }} />
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
    backgroundColor: colors.background,
    borderTopColor: "rgba(194, 198, 211, 0.12)",
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: colors.background,
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
