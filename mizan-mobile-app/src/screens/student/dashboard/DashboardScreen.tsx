import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Bell,
  CalendarDays,
  Clock,
  MapPin,
  Mic,
  Moon,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  LoadingState,
  Metric,
  styles as uiStyles,
} from "../../../components/ui";
import { analyticsApi, studentsApi } from "../../../lib/api";
import {
  readPinnedCommitment,
  subscribePinnedCommitment,
  type PinnedCommitment,
} from "../../../lib/agent-commitments";
import type { MainStackParamList } from "../../../navigation/types";
import type { ScheduleEntry, StudentContext, StudentDashboard, WeeklyReport } from "../../../lib/types";
import { scheduleForWeekDay, todayWeekdayName } from "../../../lib/student-calendar";
import { useAuth } from "../../../context/AuthContext";
import { colors, radius, spacing } from "../../../theme";
import { styles } from "../styles";
import type { Nav } from "../types";
import { dateLabel, formatModeElapsed, getSuggestedVoicePeriod, modeLabel } from "../utils";
import { useLoader } from "../hooks/useLoader";
import { useLiveNow } from "../hooks/useLiveNow";

const logoIcon = require("../../../../assets/MIZAN_ICON.png");

function formatTimeShort(time: string) {
  return String(time).slice(0, 5);
}

function stressTone(level: string): "success" | "warning" | "danger" {
  if (level === "LOW") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}

function ScheduleTimelineItem({ entry }: { entry: ScheduleEntry }) {
  return (
    <View style={scheduleStyles.item}>
      <View style={scheduleStyles.timeCol}>
        <Text style={scheduleStyles.time}>{formatTimeShort(entry.start_time)}</Text>
        <Text style={scheduleStyles.timeEnd}>{formatTimeShort(entry.end_time)}</Text>
      </View>
      <View style={scheduleStyles.lineCol}>
        <View style={scheduleStyles.dot} />
        <View style={scheduleStyles.line} />
      </View>
      <View style={scheduleStyles.body}>
        <Text style={scheduleStyles.subject}>{entry.subject}</Text>
        {entry.room ? (
          <View style={scheduleStyles.metaRow}>
            <MapPin color={colors.muted} size={12} />
            <Text style={scheduleStyles.meta}>{entry.room}</Text>
          </View>
        ) : null}
        {entry.professor ? (
          <View style={scheduleStyles.metaRow}>
            <Clock color={colors.muted} size={12} />
            <Text style={scheduleStyles.meta}>{entry.professor}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function DashboardScreen({ navigation, unreadCount = 0 }: { navigation: Nav; unreadCount?: number }) {
  const stackNav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { student } = useAuth();
  const { data, loading, error, load } = useLoader<StudentDashboard>(() => analyticsApi.dashboard());
  const schedulesLoader = useLoader(() => studentsApi.mySchedules());
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [context, setContext] = useState<StudentContext | null>(null);
  const [pinned, setPinned] = useState<PinnedCommitment | null>(null);

  const refreshPinned = useCallback(async () => {
    setPinned(await readPinnedCommitment());
  }, []);

  const refreshContext = useCallback(() => {
    void studentsApi.context().then(setContext).catch(() => setContext(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPinned();
      void schedulesLoader.load();
      void refreshContext();
      return subscribePinnedCommitment(setPinned);
    }, [refreshPinned, refreshContext])
  );

  const now = useLiveNow();
  const currentMode = context?.current_mode ?? data?.current_mode ?? null;
  const modeElapsed = currentMode?.started_at ? formatModeElapsed(currentMode.started_at, now) : null;

  useEffect(() => {
    if (!data) return;
    void Promise.all([
      analyticsApi.weeklyReport().then(setWeekly).catch(() => setWeekly(null)),
      studentsApi.context().then(setContext).catch(() => setContext(null)),
    ]);
  }, [data?.student?.id]);

  if (loading && !data) {
    return (
      <Screen variant="tab">
        <LoadingState label="Loading dashboard..." />
      </Screen>
    );
  }

  const todayFromApi = context?.today_schedule ?? data?.today_schedule ?? [];
  const todayFromSchedules = scheduleForWeekDay(schedulesLoader.data ?? [], todayWeekdayName());
  const todaySchedule = todayFromSchedules.length ? todayFromSchedules : todayFromApi;
  const upcomingExams = context?.upcoming_exams ?? data?.upcoming_exams ?? [];
  const nearestExam = upcomingExams[0];
  const completedCheckins = (data?.has_morning_checkin ? 1 : 0) + (data?.has_evening_checkin ? 1 : 0);
  const morningDone = data?.has_morning_checkin ?? false;
  const eveningDone = data?.has_evening_checkin ?? false;
  const nextRitual = !morningDone ? "morning" : !eveningDone ? "evening" : null;

  return (
    <Screen variant="tab" refreshing={loading || schedulesLoader.loading} onRefresh={() => { void load(); void schedulesLoader.load(); }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
          <Image source={logoIcon} style={{ width: 44, height: 44, borderRadius: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
              Hi {data?.student.first_name ?? student?.first_name ?? ""}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{completedCheckins}/2 rituals today</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.navigate("Notifications")} style={{ padding: 8 }}>
          <Bell color={colors.primary} size={22} />
          {unreadCount > 0 ? (
            <View style={{ position: "absolute", right: 2, top: 2, backgroundColor: colors.danger, borderRadius: 999, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "900" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ErrorBanner message={error || schedulesLoader.error} onRetry={() => { void load(); void schedulesLoader.load(); }} />

      {/* Wellbeing hero */}
      <View style={wellbeingStyles.hero}>
        <View style={wellbeingStyles.badge}>
          <Text style={wellbeingStyles.badgeText}>Daily wellbeing</Text>
        </View>
        <Text style={wellbeingStyles.title}>
          {completedCheckins === 2
            ? "You're balanced for today"
            : nextRitual === "morning"
              ? "Start your morning ritual"
              : "How was your day?"}
        </Text>
        <Text style={wellbeingStyles.sub}>
          {completedCheckins === 2
            ? "Both rituals done — your weekly insights stay fresh."
            : nextRitual === "morning"
              ? "A quick voice or quiz check-in sets mood, sleep, and focus."
              : "Close the loop with an evening review."}
        </Text>
        <View style={wellbeingStyles.pills}>
          <View style={[wellbeingStyles.pill, morningDone && wellbeingStyles.pillDone]}>
            <Sun color={morningDone ? colors.success : colors.warning} size={14} />
            <Text style={wellbeingStyles.pillText}>Morning {morningDone ? "· done" : "· pending"}</Text>
          </View>
          <View style={[wellbeingStyles.pill, eveningDone && wellbeingStyles.pillDone]}>
            <Moon color={eveningDone ? colors.success : colors.primary} size={14} />
            <Text style={wellbeingStyles.pillText}>Evening {eveningDone ? "· done" : "· pending"}</Text>
          </View>
        </View>
        {completedCheckins < 2 ? (
          <View style={wellbeingStyles.actions}>
            <Pressable
              onPress={() => navigation.navigate("VoiceCheckin", { period: getSuggestedVoicePeriod() })}
              style={({ pressed }) => [wellbeingStyles.actionCard, pressed && { opacity: 0.9 }]}
            >
              <View style={wellbeingStyles.actionIcon}>
                <Mic color={colors.primary} size={18} />
              </View>
              <View>
                <Text style={wellbeingStyles.actionTitle}>Voice mode</Text>
                <Text style={wellbeingStyles.actionSub}>Hands-free, AI-guided</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() =>
                navigation.navigate(nextRitual === "evening" ? "EveningCheckin" : "MorningCheckin")
              }
              style={({ pressed }) => [wellbeingStyles.actionCard, pressed && { opacity: 0.9 }]}
            >
              <View style={wellbeingStyles.actionIcon}>
                {nextRitual === "evening" ? (
                  <Moon color={colors.primary} size={18} />
                ) : (
                  <Sun color={colors.primary} size={18} />
                )}
              </View>
              <View>
                <Text style={wellbeingStyles.actionTitle}>Quiz mode</Text>
                <Text style={wellbeingStyles.actionSub}>Quick adaptive questions</Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <Button
            variant="secondary"
            onPress={() => navigation.switchTab?.("Checkin")}
            style={{ marginTop: spacing.sm }}
          >
            Open check-in center
          </Button>
        )}
      </View>

      {pinned ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Today&apos;s focus</Text>
          <Text style={styles.listTitle}>{pinned.title}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button variant="secondary" onPress={() => stackNav.navigate("AgentContracts")} style={{ flex: 1 }}>
              View commitment
            </Button>
          </View>
        </Card>
      ) : null}

      {currentMode ? (
        <Pressable onPress={() => stackNav.navigate("Modes")}>
          <Card style={[styles.gapCard, styles.modeBanner]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modeBannerMeta}>Focus mode · live</Text>
                <Text style={styles.modeBannerTitle}>{modeLabel(currentMode.mode)}</Text>
              </View>
              <Clock color={colors.onPrimary} size={22} />
            </View>
            {modeElapsed ? (
              <Text
                style={{
                  color: colors.onPrimary,
                  fontSize: 36,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "900",
                  letterSpacing: 1,
                }}
              >
                {modeElapsed}
              </Text>
            ) : null}
            <Text style={[styles.modeBannerMeta, { marginTop: spacing.xs }]}>Tap to manage mode</Text>
          </Card>
        </Pressable>
      ) : null}

      {/* Schedule — prominent on home */}
      <Card style={styles.gapCard}>
        <View style={styles.spaceBetween}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <CalendarDays color={colors.primary} size={18} />
            <Text style={uiStyles.h2}>Today&apos;s schedule</Text>
          </View>
          <Pressable onPress={() => navigation.navigate("ScheduleWeek")}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>View week</Text>
          </Pressable>
        </View>
        {todaySchedule.length ? (
          todaySchedule.map((entry, index) => (
            <View key={entry.id}>
              <ScheduleTimelineItem entry={entry} />
              {index < todaySchedule.length - 1 ? null : null}
            </View>
          ))
        ) : (
          <Text style={uiStyles.muted}>No classes today.</Text>
        )}
      </Card>

      <Card style={styles.gapCard}>
        <View style={styles.spaceBetween}>
          <Text style={uiStyles.h2}>This week</Text>
          <Pressable onPress={() => navigation.navigate("WeeklyReport")}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Full report</Text>
          </Pressable>
        </View>
        {weekly ? (
          <>
            <View style={styles.metricRow}>
              <Metric label="Mood" value={weekly.avg_mood.toFixed(1)} tone="primary" />
              <Metric label="Sleep" value={`${weekly.avg_sleep.toFixed(1)}h`} tone="purple" />
            </View>
            <View style={styles.metricRow}>
              <Metric label="Check-ins" value={weekly.total_checkins} tone="success" />
              <Metric label="Goals" value={weekly.goals_achieved} tone="warning" />
            </View>
            <Badge tone={stressTone(String(weekly.stress_level))}>
              Stress · {String(weekly.stress_level).toLowerCase()}
            </Badge>
          </>
        ) : (
          <Text style={uiStyles.muted}>Complete rituals to see your week.</Text>
        )}
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Today</Text>
        <View style={styles.listRow}>
          <Target color={colors.primary} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>Deadline</Text>
            <Text style={uiStyles.muted}>
              {nearestExam ? `${nearestExam.subject} · ${dateLabel(nearestExam.exam_date)}` : "Nothing urgent"}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.quickGrid}>
        <Button variant="secondary" onPress={() => navigation.navigate("Goals")} style={styles.quickButton}>
          <Target color={colors.primary} size={16} />
          Goals
        </Button>
        <Button variant="secondary" onPress={() => navigation.navigate("Modes")} style={styles.quickButton}>
          <TrendingUp color={colors.primary} size={16} />
          Modes
        </Button>
      </View>
    </Screen>
  );
}

const scheduleStyles = {
  item: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  timeCol: {
    width: 48,
  },
  time: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  timeEnd: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  lineCol: {
    alignItems: "center" as const,
    width: 16,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  line: {
    backgroundColor: "rgba(0,92,174,0.2)",
    flex: 1,
    marginTop: 4,
    width: 2,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  subject: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700" as const,
  },
  metaRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 4,
    marginTop: 4,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
};

const wellbeingStyles = {
  hero: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(0,92,174,0.15)",
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: "hidden" as const,
    padding: spacing.lg,
  },
  badge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "rgba(0,92,174,0.15)",
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800" as const,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800" as const,
    lineHeight: 26,
  },
  sub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  pills: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pill: {
    alignItems: "center" as const,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "rgba(194,198,211,0.4)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillDone: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(5,150,105,0.25)",
  },
  pillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700" as const,
  },
  actions: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionCard: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row" as const,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  actionIcon: {
    alignItems: "center" as const,
    backgroundColor: "rgba(0,92,174,0.1)",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center" as const,
    width: 40,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  actionSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
};
