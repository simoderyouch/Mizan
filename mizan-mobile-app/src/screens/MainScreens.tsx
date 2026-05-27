import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import {
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Dumbbell,
  FileText,
  History,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  Trash2,
  User,
  Video,
  X,
  Mic,
} from "lucide-react-native";
import { Screen } from "../components/screen";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  Metric,
  SectionTitle,
  styles as uiStyles,
} from "../components/ui";
import {
  agentApi,
  analyticsApi,
  authApi,
  checkinsApi,
  filesApi,
  getApiErrorMessage,
  goalsApi,
  healthApi,
  API_ORIGIN,
  modesApi,
  notificationsApi,
  resourcesApi,
  tasksApi,
  voiceApi,
} from "../lib/api";
import type {
  AgentActionContract,
  AgentChatMessage,
  AgentTestRun,
  ChatTaskSuggestion,
  CheckinAnswerPayload,
  CheckinQuestion,
  DetailedHealthResponse,
  Goal,
  GoalTodaySummary,
  GoalWithProgress,
  Mode,
  ModeStats,
  Notification,
  Resource,
  StudentDashboard,
  Task,
  WeeklyReport,
} from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadow, spacing } from "../theme";

const icon = require("../../assets/MIZAN_ICON.png");
const todayIso = () => new Date().toISOString().slice(0, 10);
const isDone = (task: Task) => task.status === "done";
const modeOptions: Mode[] = ["REVISION", "EXAMEN", "PROJET", "REPOS", "SPORT", "COURS"];

type Nav = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
};

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function checkinAnswers(answers: Record<string, string | number | boolean | string[]>) {
  return Object.entries(answers).map(([question_id, value]) => ({ question_id, value })) as CheckinAnswerPayload[];
}

function tasksFromPlan(lines: string[], source: "morning_checkin" | "voice_chat") {
  return lines
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((title) => ({
      title,
      due_date: todayIso(),
      source,
    }));
}

function useLoader<T>(loader: () => Promise<T>, deps: React.DependencyList = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setData(await loaderRef.current());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, ...deps])
  );

  return { data, loading, error, load, setData, setError };
}

function RowAction({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.rowAction, pressed && styles.rowActionPressed]}>
      <View style={styles.rowIcon}>
        <Icon color={colors.primary} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={uiStyles.h3}>{title}</Text>
        {subtitle ? <Text style={uiStyles.muted}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={colors.muted} size={20} />
    </Pressable>
  );
}

function MoodPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.moodRow}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          onPress={() => onChange(score)}
          style={[styles.moodDot, value === score && styles.moodDotActive]}
        >
          <Text style={[styles.moodText, value === score && styles.moodTextActive]}>{score}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VoiceOrb({
  active,
  danger = false,
  size = 58,
}: {
  active: boolean;
  danger?: boolean;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.38] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const tone = danger ? colors.danger : colors.primary;

  return (
    <View style={[styles.voiceOrbWrap, { height: size, width: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.voiceOrbPulse,
          {
            backgroundColor: tone,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <View style={[styles.voiceOrb, { backgroundColor: tone }]}>
        {danger ? <Square color={colors.onPrimary} size={size * 0.34} /> : <Mic color={colors.onPrimary} size={size * 0.38} />}
      </View>
    </View>
  );
}

function VoiceBars({ active }: { active: boolean }) {
  return (
    <View style={styles.voiceBars}>
      {[18, 30, 23, 38, 26, 32, 20].map((height, index) => (
        <View
          key={`${height}-${index}`}
          style={[
            styles.voiceBar,
            {
              height: active ? height : Math.max(8, Math.round(height * 0.42)),
              opacity: active ? 1 - index * 0.055 : 0.36,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function DashboardScreen({ navigation, unreadCount = 0 }: { navigation: Nav; unreadCount?: number }) {
  const { student } = useAuth();
  const { data, loading, error, load } = useLoader<StudentDashboard>(() => analyticsApi.dashboard());

  if (loading && !data) return <Screen><LoadingState /></Screen>;

  const averageMood = (() => {
    const trend = data?.mood_trend ?? [];
    if (!trend.length) return "N/A";
    const sum = trend.reduce((acc, point) => acc + (Number(point.mood_score) || 3), 0);
    return (sum / trend.length).toFixed(1);
  })();

  const checkinStatusText = (() => {
    const morning = data?.has_morning_checkin;
    const evening = data?.has_evening_checkin;
    if (morning && evening) return "Complet ✓";
    if (morning || evening) return "En cours ·";
    return "À faire";
  })();

  const checkinStatusColor = (() => {
    const morning = data?.has_morning_checkin;
    const evening = data?.has_evening_checkin;
    if (morning && evening) return colors.success;
    if (morning || evening) return colors.warning;
    return colors.muted;
  })();

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <SectionTitle
        title={`Bonjour ${data?.student.first_name ?? student?.first_name ?? ""}`}
        subtitle="Votre journée, vos priorités et votre équilibre."
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              onPress={() => navigation.navigate("Notifications")}
              style={({ pressed }) => [
                { position: "relative", padding: 4 },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Bell color={colors.primary} size={24} />
              {unreadCount > 0 ? (
                <View style={{
                  position: "absolute",
                  right: -2,
                  top: -2,
                  backgroundColor: colors.danger,
                  borderRadius: 999,
                  minWidth: 16,
                  height: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3
                }}>
                  <Text style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "900" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Image source={icon} style={styles.titleIcon} />
          </View>
        }
      />
      <ErrorBanner message={error} onRetry={load} />
      {data?.current_mode ? (
        <Card style={[styles.modeBanner, { marginTop: error ? spacing.lg : 0 }]}>
          <Badge tone="primary">Mode actif</Badge>
          <Text style={styles.modeBannerTitle}>{data.current_mode.mode}</Text>
          <Text style={styles.modeBannerMeta}>
            Lancé à {new Date(data.current_mode.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </Card>
      ) : null}

      <View style={styles.metricRow}>
        <Metric label="Objectifs actifs" value={data?.active_goals_count ?? 0} tone="primary" />
        <Metric
          label="Check-in matin"
          value={data?.has_morning_checkin ? "OK" : "À faire"}
          tone={data?.has_morning_checkin ? "success" : "warning"}
        />
      </View>
      <View style={styles.metricRow}>
        <Metric
          label="Check-in soir"
          value={data?.has_evening_checkin ? "OK" : "À faire"}
          tone={data?.has_evening_checkin ? "success" : "warning"}
        />
        <Metric label="Examens" value={data?.upcoming_exams.length ?? 0} tone="purple" />
      </View>

      <Button onPress={() => navigation.navigate("VoiceCheckin")} style={styles.voiceCheckinButton}>
        <VoiceOrb active={false} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.voiceCheckinTitle}>Check-in vocal</Text>
          <Text style={styles.voiceCheckinSub}>Session guidée, transcription et plan d'action.</Text>
        </View>
        <ChevronRight color="rgba(255,255,255,0.7)" size={22} />
      </Button>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Actions rapides</Text>
        <View style={styles.quickGrid}>
          <Button variant="secondary" onPress={() => navigation.navigate("MorningCheckin")} style={styles.quickButton}>
            <Sparkles color={colors.primary} size={18} />
            Check-in matin
          </Button>
          <Button variant="secondary" onPress={() => navigation.navigate("EveningCheckin")} style={styles.quickButton}>
            <Moon color={colors.primary} size={18} />
            Check-in soir
          </Button>
          <Button variant="secondary" onPress={() => navigation.navigate("Goals")} style={styles.quickButton}>
            <Target color={colors.primary} size={18} />
            Objectifs
          </Button>
          <Button variant="secondary" onPress={() => navigation.navigate("Modes")} style={styles.quickButton}>
            <Clock3 color={colors.primary} size={18} />
            Modes
          </Button>
        </View>
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Aujourd'hui</Text>
        {data?.today_schedule.length ? (
          data.today_schedule.slice(0, 4).map((entry) => (
            <View key={entry.id} style={styles.listRow}>
              <CalendarDays color={colors.primary} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{entry.subject}</Text>
                <Text style={uiStyles.muted}>{entry.start_time} - {entry.end_time} · {entry.room}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={uiStyles.muted}>Aucun cours planifié aujourd'hui.</Text>
        )}
      </Card>

      {/* ── Two-Column side-by-side Layout: Mood Trend & Wellbeing Summary ── */}
      <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
        {/* Left Column: Tendance humeur (flex: 1.3) */}
        <Card style={{ flex: 1.3, gap: spacing.md, marginBottom: 0 }}>
          <Text style={uiStyles.h2}>Tendance humeur</Text>
          <View style={styles.barRow}>
            {(data?.mood_trend ?? []).slice(-7).map((point) => {
              const score = Number(point.mood_score) || 3;
              const activeHeight = Math.max(12, score * 17); // score 1-5 maps to 17px-85px
              const dayLabel = (() => {
                if (!point.date) return "";
                const parts = String(point.date).split("-");
                if (parts.length === 3) return parts[2].replace(/^0/, "");
                const d = new Date(point.date);
                return isNaN(d.getDate()) ? "" : String(d.getDate());
              })();
              const barColor = score >= 4 ? colors.success : score === 3 ? colors.primary : colors.warning;
              return (
                <View key={point.date} style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: activeHeight, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.barLabel}>{dayLabel}</Text>
                </View>
              );
            })}
          </View>
          {!data?.mood_trend?.length ? <Text style={uiStyles.muted}>La courbe apparaîtra après vos check-ins.</Text> : null}
        </Card>

        {/* Right Column: Équilibre & État (flex: 1) */}
        <Card style={{ flex: 1, gap: spacing.sm, marginBottom: 0, justifyContent: "space-between", paddingVertical: spacing.md }}>
          <View>
            <Text style={[uiStyles.h2, { fontSize: 16 }]}>Mon équilibre</Text>
            <Text style={[uiStyles.muted, { fontSize: 11 }]}>Moyenne bien-être</Text>
          </View>

          <View style={{ alignItems: "center", marginVertical: spacing.xs }}>
            <Text style={{ fontSize: 28, fontWeight: "900", color: colors.primary }}>{averageMood}</Text>
            <Text style={[uiStyles.muted, { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 }]}>SUR 5.0</Text>
          </View>

          <View style={{ gap: spacing.xs, borderTopColor: "rgba(194,198,211,0.18)", borderTopWidth: 1, paddingTop: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "700" }}>Rituels</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: checkinStatusColor }}>{checkinStatusText}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "700" }}>Focus</Text>
              <Text style={{ fontSize: 10, fontWeight: "800", color: data?.current_mode ? colors.primary : colors.muted }}>
                {data?.current_mode ? "Actif" : "Aucun"}
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

export function CheckinHubScreen({ navigation }: { navigation: Nav }) {
  const { data, loading, error, load } = useLoader(() => checkinsApi.morningBriefing());
  if (loading && !data) return <Screen><LoadingState /></Screen>;
  const morningDone = data?.checkin_status?.has_morning_today;
  const eveningDone = data?.checkin_status?.has_evening_today;
  const completedCount = Number(Boolean(morningDone)) + Number(Boolean(eveningDone));
  const completionLabel = completedCount === 2 ? "Rituel complet" : completedCount === 1 ? "Rituel en cours" : "Rituel à lancer";
  const suggestedMode = data?.suggested_mode ?? "COURS";
  const riskTone = data?.wellbeing_alert === "HIGH" ? "danger" : data?.wellbeing_alert === "MEDIUM" ? "warning" : "success";

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <SectionTitle title="Rituel" subtitle="Choisissez le bon format, Mizan garde le fil." />
      <ErrorBanner message={error} onRetry={load} />

      <Card style={styles.ritualHero}>
        <View style={styles.ritualHeroTop}>
          <View style={styles.ritualHeroMark}>
            <Sparkles color={colors.onPrimary} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualHeroEyebrow}>Aujourd'hui</Text>
            <Text style={styles.ritualHeroTitle}>{completionLabel}</Text>
          </View>
          <Badge tone={completedCount === 2 ? "success" : "warning"}>{completedCount}/2</Badge>
        </View>

        <View style={styles.ritualProgressTrack}>
          <View style={[styles.ritualProgressFill, { width: `${Math.max(8, completedCount * 50)}%` }]} />
        </View>

        <View style={styles.ritualHeroMetrics}>
          <View style={styles.ritualHeroMetric}>
            <Text style={styles.ritualHeroMetricLabel}>Mode</Text>
            <Text style={styles.ritualHeroMetricValue}>{suggestedMode}</Text>
          </View>
          <View style={styles.ritualHeroMetric}>
            <Text style={styles.ritualHeroMetricLabel}>Cours</Text>
            <Text style={styles.ritualHeroMetricValue}>{data?.today_schedule.length ?? 0}</Text>
          </View>
          <View style={styles.ritualHeroMetric}>
            <Text style={styles.ritualHeroMetricLabel}>Examens</Text>
            <Text style={styles.ritualHeroMetricValue}>{data?.upcoming_exams.length ?? 0}</Text>
          </View>
        </View>
      </Card>

      <Pressable
        onPress={() => navigation.navigate("VoiceCheckin")}
        style={({ pressed }) => [styles.ritualVoicePanel, pressed && styles.voicePressed]}
      >
        <View style={styles.ritualVoiceLeft}>
          <VoiceOrb active size={72} />
          <VoiceBars active />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ritualVoiceTitle}>Check-in vocal</Text>
          <Text style={styles.ritualVoiceSub}>Parlez naturellement. Mizan transcrit, analyse et prépare les prochaines actions.</Text>
        </View>
        <ChevronRight color="rgba(255,255,255,0.72)" size={22} />
      </Pressable>

      <View style={styles.ritualPath}>
        <Pressable
          onPress={() => navigation.navigate("MorningCheckin")}
          style={({ pressed }) => [styles.ritualStepCard, morningDone && styles.ritualStepCardDone, pressed && styles.voicePressed]}
        >
          <View style={[styles.ritualStepIcon, morningDone && styles.ritualStepIconDone]}>
            {morningDone ? <CheckCircle2 color={colors.success} size={20} /> : <Sparkles color={colors.primary} size={20} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualStepTitle}>Matin</Text>
            <Text style={styles.ritualStepSub}>Sommeil, humeur, mode du jour.</Text>
          </View>
          <Badge tone={morningDone ? "success" : "warning"}>{morningDone ? "Fait" : "À faire"}</Badge>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("EveningCheckin")}
          style={({ pressed }) => [styles.ritualStepCard, eveningDone && styles.ritualStepCardDone, pressed && styles.voicePressed]}
        >
          <View style={[styles.ritualStepIcon, eveningDone && styles.ritualStepIconDone]}>
            {eveningDone ? <CheckCircle2 color={colors.success} size={20} /> : <Moon color={colors.primary} size={20} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualStepTitle}>Soir</Text>
            <Text style={styles.ritualStepSub}>Bilan, plan accompli, récupération.</Text>
          </View>
          <Badge tone={eveningDone ? "success" : "warning"}>{eveningDone ? "Fait" : "À faire"}</Badge>
        </Pressable>
      </View>

      <Card style={styles.ritualInsightCard}>
        <View style={styles.spaceBetween}>
          <Text style={uiStyles.h2}>Priorités</Text>
          <Badge tone={riskTone}>Alerte {data?.wellbeing_alert ?? "NONE"}</Badge>
        </View>
        {data?.priority_items.length ? data.priority_items.map((item, index) => (
          <View key={item} style={styles.ritualPriorityRow}>
            <Text style={styles.ritualPriorityIndex}>{index + 1}</Text>
            <Text style={styles.ritualPriorityText}>{item}</Text>
          </View>
        )) : <Text style={uiStyles.muted}>Aucune priorité spéciale pour le moment.</Text>}
      </Card>

      <Card style={styles.ritualContextCard}>
        <View style={styles.ritualContextRow}>
          <ShieldCheck color={colors.primary} size={19} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ritualContextTitle}>Lecture du contexte</Text>
            <Text style={uiStyles.muted}>Le rituel s'adapte aux cours, examens et signaux de bien-être.</Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function QuestionForm({
  questions,
  answers,
  onAnswer,
}: {
  questions: CheckinQuestion[];
  answers: Record<string, string | number | boolean | string[]>;
  onAnswer: (id: string, value: string | number | boolean | string[]) => void;
}) {
  if (!questions.length) return null;
  return (
    <Card style={styles.gapCard}>
      <Text style={uiStyles.h2}>Questions personnalisées</Text>
      {questions.map((question) => (
        <View key={question.id} style={{ gap: spacing.sm }}>
          <Text style={uiStyles.label}>{question.text}</Text>
          {question.answer_type === "single_choice" && question.options ? (
            <View style={styles.choiceWrap}>
              {question.options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => onAnswer(question.id, option)}
                  style={[styles.choice, answers[question.id] === option && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, answers[question.id] === option && styles.choiceTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
          ) : question.answer_type === "boolean" ? (
            <View style={styles.choiceWrap}>
              {[true, false].map((value) => (
                <Pressable
                  key={String(value)}
                  onPress={() => onAnswer(question.id, value)}
                  style={[styles.choice, answers[question.id] === value && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, answers[question.id] === value && styles.choiceTextActive]}>
                    {value ? "Oui" : "Non"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Field
              keyboardType={question.answer_type === "number" || question.answer_type === "scale" ? "numeric" : "default"}
              onChangeText={(value) => onAnswer(question.id, question.answer_type === "number" || question.answer_type === "scale" ? Number(value) : value)}
              placeholder="Votre réponse"
              value={String(answers[question.id] ?? "")}
            />
          )}
        </View>
      ))}
    </Card>
  );
}

export function MorningCheckinScreen({ navigation }: { navigation: Nav }) {
  const [sleep, setSleep] = useState("7");
  const [mood, setMood] = useState(3);
  const [mode, setMode] = useState<Mode>("COURS");
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [result, setResult] = useState<string | null>(null);
  const [planTasks, setPlanTasks] = useState<string[]>([]);
  const [tasksCreated, setTasksCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      const loadQuestions = async () => {
        try {
          setError("");
          const res = await checkinsApi.questions("MORNING", "qcm");
          setQuestions(res.questions);
        } catch (err) {
          setQuestions([]);
          setError(getApiErrorMessage(err, "Impossible de charger les questions du check-in matinal."));
        }
      };
      void loadQuestions();
    }, [])
  );

  const submit = async () => {
    const sleepHours = Number(sleep);
    if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 14) {
      setError("Entrez un sommeil valide entre 0 et 14 heures.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await checkinsApi.createMorning({
        sleep_hours: sleepHours,
        mood_score: mood,
        mode,
        question_set: questions,
        responses: checkinAnswers(answers),
      });
      setResult(response.executive_summary ?? "Check-in enregistré.");
      setPlanTasks(response.detailed_action_plan ?? []);
      setTasksCreated("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d'enregistrer le check-in."));
    } finally {
      setLoading(false);
    }
  };

  const createPlanTasks = async () => {
    const tasks = tasksFromPlan(planTasks, "morning_checkin");
    if (!tasks.length) return;
    setTaskLoading(true);
    setError("");
    try {
      await tasksApi.createMany({ tasks });
      setTasksCreated(`${tasks.length} tâche(s) ajoutée(s) à aujourd'hui.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de créer les tâches du plan."));
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Check-in matinal" subtitle="Réglez le rythme de votre journée." />
      <ErrorBanner message={error} />
      <Card style={styles.gapCard}>
        <Field label="Heures de sommeil" keyboardType="numeric" value={sleep} onChangeText={setSleep} />
        <Text style={uiStyles.label}>Humeur</Text>
        <MoodPicker value={mood} onChange={setMood} />
        <Text style={uiStyles.label}>Mode du jour</Text>
        <View style={styles.choiceWrap}>
          {modeOptions.map((item) => (
            <Pressable key={item} onPress={() => setMode(item)} style={[styles.choice, mode === item && styles.choiceActive]}>
              <Text style={[styles.choiceText, mode === item && styles.choiceTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <QuestionForm questions={questions} answers={answers} onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))} />
      {result ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Plan généré</Text>
          <Text style={uiStyles.muted}>{result}</Text>
          {planTasks.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
          {tasksCreated ? <Text style={styles.successText}>{tasksCreated}</Text> : null}
          {planTasks.length ? <Button loading={taskLoading} variant="secondary" onPress={createPlanTasks}>Créer les tâches</Button> : null}
        </Card>
      ) : null}
      <Button loading={loading} onPress={submit}>Enregistrer</Button>
      <Button variant="ghost" onPress={() => navigation.goBack()}>Retour</Button>
    </Screen>
  );
}

export function EveningCheckinScreen({ navigation }: { navigation: Nav }) {
  const [planCompleted, setPlanCompleted] = useState(true);
  const [mood, setMood] = useState(3);
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [result, setResult] = useState<string | null>(null);
  const [planTasks, setPlanTasks] = useState<string[]>([]);
  const [tasksCreated, setTasksCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      const loadQuestions = async () => {
        try {
          setError("");
          const res = await checkinsApi.questions("EVENING", "qcm");
          setQuestions(res.questions);
        } catch (err) {
          setQuestions([]);
          setError(getApiErrorMessage(err, "Impossible de charger les questions du check-in du soir."));
        }
      };
      void loadQuestions();
    }, [])
  );

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await checkinsApi.createEvening({
        plan_completed: planCompleted,
        mood_score: mood,
        notes,
        question_set: questions,
        responses: checkinAnswers(answers),
      });
      setResult(response.executive_summary ?? "Bilan enregistré.");
      setPlanTasks(response.detailed_action_plan ?? []);
      setTasksCreated("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d'enregistrer le bilan."));
    } finally {
      setLoading(false);
    }
  };

  const createPlanTasks = async () => {
    const tasks = tasksFromPlan(planTasks, "morning_checkin");
    if (!tasks.length) return;
    setTaskLoading(true);
    setError("");
    try {
      await tasksApi.createMany({ tasks });
      setTasksCreated(`${tasks.length} tâche(s) ajoutée(s) à aujourd'hui.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de créer les tâches du bilan."));
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Check-in du soir" subtitle="Clôturez la journée sans bruit inutile." />
      <ErrorBanner message={error} />
      <Card style={styles.gapCard}>
        <Text style={uiStyles.label}>Plan accompli ?</Text>
        <View style={styles.choiceWrap}>
          {[true, false].map((value) => (
            <Pressable key={String(value)} onPress={() => setPlanCompleted(value)} style={[styles.choice, planCompleted === value && styles.choiceActive]}>
              <Text style={[styles.choiceText, planCompleted === value && styles.choiceTextActive]}>{value ? "Oui" : "Pas encore"}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={uiStyles.label}>Humeur</Text>
        <MoodPicker value={mood} onChange={setMood} />
        <Field label="Notes" multiline value={notes} onChangeText={setNotes} placeholder="Ce qui a aidé, ce qui a pesé..." style={{ minHeight: 96, textAlignVertical: "top" }} />
      </Card>
      <QuestionForm questions={questions} answers={answers} onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))} />
      {result ? (
        <Card style={styles.gapCard}>
          <Text style={uiStyles.h2}>Analyse</Text>
          <Text style={uiStyles.muted}>{result}</Text>
          {planTasks.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
          {tasksCreated ? <Text style={styles.successText}>{tasksCreated}</Text> : null}
          {planTasks.length ? <Button loading={taskLoading} variant="secondary" onPress={createPlanTasks}>Créer les tâches</Button> : null}
        </Card>
      ) : null}
      <Button loading={loading} onPress={submit}>Enregistrer</Button>
      <Button variant="ghost" onPress={() => navigation.goBack()}>Retour</Button>
    </Screen>
  );
}

export function VoiceCheckinScreen() {
  const [period, setPeriod] = useState<"MORNING" | "EVENING">("MORNING");
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<Array<{ id: string; text: string; index: number }>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcriptions, setTranscriptions] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [transcribingIndex, setTranscribingIndex] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [tasksCreated, setTasksCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setLoading(true);
    setError("");
    setAnalysis("");
    setRecommendations([]);
    setTasksCreated("");
    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => undefined);
      setRecording(null);
      setRecordingIndex(null);
    }
    try {
      const res = await voiceApi.start(period);
      setSessionId(res.session_id);
      setQuestions(res.questions.map((q) => ({ id: q.id, text: q.text, index: q.index })));
      setCurrentQuestionIndex(0);
      setTranscriptions({});
    } catch (err) {
      setSessionId("");
      setQuestions([]);
      setTranscriptions({});
      setError(getApiErrorMessage(err, "Impossible de démarrer la session vocale backend."));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!sessionId) {
      setError("Démarrez une session vocale avant l'analyse.");
      return;
    }
    const filledTranscriptions = questions
      .map((q) => ({
        question_index: q.index,
        question_id: q.id,
        transcription: (transcriptions[q.index] ?? "").trim(),
      }))
      .filter((item) => item.transcription.length > 0);
    if (!filledTranscriptions.length) {
      setError("Ajoutez au moins une réponse vocale ou textuelle avant l'analyse.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await voiceApi.submit({
        session_id: sessionId,
        period,
        transcriptions: filledTranscriptions,
      });
      setAnalysis(res.analysis);
      setRecommendations(res.recommendations ?? []);
      setTasksCreated("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible d'analyser les réponses."));
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (recording || !questions.length) return;
    setError("");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("Autorisez le micro pour enregistrer une réponse.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: nextRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(nextRecording);
      setRecordingIndex(currentQuestionIndex);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de démarrer l'enregistrement."));
    }
  };

  const stopRecording = async () => {
    if (!recording || recordingIndex === null) return;
    const currentIndex = recordingIndex;
    setTranscribingIndex(currentIndex);
    setError("");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingIndex(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) return;
      const res = await voiceApi.transcribe({
        uri,
        name: `voice-question-${currentIndex + 1}.m4a`,
        type: "audio/m4a",
      });
      setTranscriptions((prev) => ({ ...prev, [currentIndex]: res.transcription }));
      if (currentIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentIndex + 1);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de transcrire l'audio. Vous pouvez saisir la réponse au clavier."));
    } finally {
      setTranscribingIndex(null);
    }
  };

  const createRecommendationTasks = async () => {
    const tasks = tasksFromPlan(recommendations, "voice_chat");
    if (!tasks.length) return;
    setTaskLoading(true);
    setError("");
    try {
      await tasksApi.createMany({ tasks });
      setTasksCreated(`${tasks.length} tâche(s) créée(s) depuis le vocal.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de créer les tâches vocales."));
    } finally {
      setTaskLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredQuestions = Object.values(transcriptions).filter((value) => value.trim().length > 0).length;
  const allQuestionsAnswered = questions.length > 0 && answeredQuestions === questions.length;
  const voiceStatusText = recording
    ? "Parlez... touchez pour arrêter."
    : transcribingIndex !== null
      ? "Transcription en cours..."
      : currentQuestion
        ? "Touchez le micro pour répondre."
        : "Démarrez une session pour charger les questions.";

  return (
    <Screen>
      <SectionTitle title="Check-in vocal" subtitle="Un rituel guidé qui écoute, transcrit et structure." />
      <ErrorBanner message={error} />
      <Card style={styles.voiceSessionCard}>
        <View style={styles.voiceSessionHeader}>
          <VoiceOrb active={Boolean(recording)} danger={Boolean(recording)} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceSessionTitle}>{recording ? "Capture active" : sessionId ? "Session prête" : "Studio vocal"}</Text>
            <Text style={styles.voiceSessionSub}>
              {recording ? "Répondez naturellement, puis arrêtez pour transcrire." : "Choisissez le moment et démarrez les questions vocales."}
            </Text>
          </View>
        </View>
        <VoiceBars active={Boolean(recording) || loading} />
        <View style={styles.voicePeriodSwitch}>
          {(["MORNING", "EVENING"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setPeriod(value)}
              style={({ pressed }) => [
                styles.voicePeriodButton,
                period === value && styles.voicePeriodButtonActive,
                pressed && styles.voicePressed,
              ]}
            >
              <Text style={[styles.voicePeriodText, period === value && styles.voicePeriodTextActive]}>
                {value === "MORNING" ? "Matin" : "Soir"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button loading={loading} onPress={start} style={styles.voicePrimaryAction}>
          {sessionId ? "Réinitialiser la session" : "Démarrer la session"}
        </Button>
      </Card>

      {recordingIndex !== null ? (
        <View style={styles.voiceLiveStrip}>
          <View style={styles.recordingDot} />
          <Text style={styles.voiceLiveText}>Question {recordingIndex + 1} en cours d'enregistrement</Text>
        </View>
      ) : null}

      {currentQuestion ? (
        <Card style={[styles.voiceQuestionCard, recording && styles.voiceQuestionCardActive]}>
          <View style={styles.voiceQuestionHeader}>
            <View style={styles.voiceQuestionNumber}>
              <Text style={styles.voiceQuestionNumberText}>{currentQuestion.index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceQuestionTitle}>{currentQuestion.text}</Text>
              <Text style={styles.voiceQuestionMeta}>
                Question {currentQuestion.index + 1} / {questions.length}
              </Text>
            </View>
          </View>

          <View style={styles.voiceCurrentRecorder}>
            <Pressable
              disabled={transcribingIndex !== null || loading}
              onPress={recording ? stopRecording : startRecording}
              style={({ pressed }) => [
                styles.voiceMainRecordButton,
                recording && styles.voiceMainRecordButtonActive,
                (transcribingIndex !== null || loading) && styles.sendButtonDisabled,
                pressed && styles.voicePressed,
              ]}
            >
              <VoiceOrb active={Boolean(recording) || transcribingIndex !== null} danger={Boolean(recording)} size={92} />
            </Pressable>
            <Text style={styles.voiceCurrentActionText}>
              {recording ? "Arrêter ma réponse" : transcribingIndex !== null ? "Transcription..." : "Répondre à cette question"}
            </Text>
            <Text style={styles.voiceCurrentHint}>{voiceStatusText}</Text>
          </View>

          {transcriptions[currentQuestion.index] ? (
            <View style={styles.voiceCurrentTranscript}>
              <Text style={styles.voiceQuestionMeta}>Réponse capturée</Text>
              <Text style={styles.ritualPriorityText}>{transcriptions[currentQuestion.index]}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {questions.length ? (
        <Card style={styles.voiceTranscriptStack}>
          <View style={styles.spaceBetween}>
            <Text style={uiStyles.h2}>Transcriptions</Text>
            <Badge tone={allQuestionsAnswered ? "success" : "primary"}>{answeredQuestions}/{questions.length}</Badge>
          </View>
          {questions.map((question) => {
            const transcription = transcriptions[question.index];
            const isCurrent = question.index === currentQuestionIndex;
            return (
              <Pressable
                key={question.id}
                onPress={() => setCurrentQuestionIndex(question.index)}
                style={({ pressed }) => [
                  styles.voiceTranscriptRow,
                  isCurrent && styles.voiceTranscriptRowActive,
                  pressed && styles.voicePressed,
                ]}
              >
                <View style={[styles.voiceQuestionNumber, transcription && styles.ritualStepIconDone]}>
                  {transcription ? (
                    <CheckCircle2 color={colors.success} size={18} />
                  ) : (
                    <Text style={styles.voiceQuestionNumberText}>{question.index + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voiceTranscriptQuestion} numberOfLines={1}>{question.text}</Text>
                  <Text style={styles.voiceTranscriptPreview} numberOfLines={2}>
                    {transcription || (isCurrent ? "Question en cours" : "Pas encore répondu")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {questions.length ? <Button loading={loading} disabled={!allQuestionsAnswered} onPress={submit} style={styles.voicePrimaryAction}>Analyser le rituel</Button> : null}
      {analysis ? (
        <Card style={styles.voiceAnalysisCard}>
          <View style={styles.voiceQuestionHeader}>
            <VoiceOrb active={false} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceQuestionTitle}>Analyse vocale</Text>
              <Text style={styles.voiceQuestionMeta}>Synthèse générée depuis vos réponses</Text>
            </View>
          </View>
          <Text style={uiStyles.muted}>{analysis}</Text>
          {recommendations.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
          {tasksCreated ? <Text style={styles.successText}>{tasksCreated}</Text> : null}
          {recommendations.length ? <Button loading={taskLoading} variant="secondary" onPress={createRecommendationTasks}>Créer les tâches</Button> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

export function TasksScreen() {
  const [creating, setCreating] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const loader = useLoader<Task[]>(() => tasksApi.list());
  const tasks = loader.data ?? [];
  const today = todayIso();
  const pending = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const todayTasks = useMemo(() => tasks.filter((task) => task.due_date === today), [tasks, today]);
  const otherTasks = useMemo(() => tasks.filter((task) => task.due_date !== today), [tasks, today]);

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditDueDate(task.due_date);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDescription("");
    setEditDueDate("");
  };

  const create = async () => {
    if (!title.trim()) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      loader.setError("Utilisez une date au format YYYY-MM-DD.");
      return;
    }
    setCreating(true);
    try {
      await tasksApi.create({ title: title.trim(), description: description.trim() || undefined, due_date: dueDate, source: "manual" });
      setTitle("");
      setDescription("");
      setDueDate(todayIso());
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not create task."));
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (task: Task) => {
    setBusyTaskId(task.id);
    try {
      await tasksApi.updateStatus(task.id, isDone(task) ? "pending" : "done");
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const remove = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      await tasksApi.remove(taskId);
      if (editingTaskId === taskId) cancelEdit();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not delete this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingTaskId || !editTitle.trim()) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDueDate)) {
      loader.setError("Utilisez une date au format YYYY-MM-DD.");
      return;
    }
    setBusyTaskId(editingTaskId);
    try {
      await tasksApi.update(editingTaskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        due_date: editDueDate,
      });
      cancelEdit();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const renderTask = (task: Task) => {
    const editing = editingTaskId === task.id;
    return (
      <Card key={task.id} style={[styles.taskCard, editing && styles.editingTaskCard]}>
        <Pressable onPress={() => toggle(task)} style={styles.taskCheck}>
          {isDone(task) ? <CheckCircle2 color={colors.success} size={24} /> : <Circle color={colors.primary} size={24} />}
        </Pressable>
        <View style={{ flex: 1 }}>
          {editing ? (
            <View style={styles.editForm}>
              <Field label="Titre" value={editTitle} onChangeText={setEditTitle} />
              <Field label="Description" value={editDescription} onChangeText={setEditDescription} placeholder="Optionnel" />
              <Field label="Date limite" value={editDueDate} onChangeText={setEditDueDate} placeholder="YYYY-MM-DD" />
              <View style={styles.inlineActions}>
                <Button variant="ghost" onPress={cancelEdit} style={styles.inlineActionButton}><X color={colors.primary} size={16} /> Annuler</Button>
                <Button loading={busyTaskId === task.id} disabled={!editTitle.trim()} onPress={saveEdit} style={styles.inlineActionButton}>Enregistrer</Button>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.listTitle, isDone(task) && styles.doneText]}>{task.title}</Text>
              {task.description ? <Text style={uiStyles.muted}>{task.description}</Text> : null}
              <View style={styles.badgeRow}>
                <Badge tone={task.due_date < today && !isDone(task) ? "danger" : "neutral"}>{dateLabel(task.due_date)}</Badge>
                <Badge>{task.source.replace("_", " ")}</Badge>
              </View>
            </>
          )}
        </View>
        {!editing ? (
          <View style={styles.taskActions}>
            <Pressable disabled={busyTaskId === task.id} onPress={() => startEdit(task)} style={styles.iconButton}>
              <Pencil color={colors.primary} size={19} />
            </Pressable>
            <Pressable disabled={busyTaskId === task.id} onPress={() => remove(task.id)} style={styles.iconButton}>
              <Trash2 color={colors.danger} size={20} />
            </Pressable>
          </View>
        ) : null}
      </Card>
    );
  };

  if (loader.loading && !loader.data) return <Screen><LoadingState label="Chargement des tâches..." /></Screen>;

  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Tâches" subtitle={`${pending.length} tâche(s) à suivre.`} />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Nouvelle tâche</Text>
        <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Réviser le chapitre 3" />
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optionnel" />
        <Field label="Date limite" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
        <Button loading={creating} disabled={!title.trim()} onPress={create}><Plus color={colors.onPrimary} size={18} /> <Text style={styles.buttonInline}>Ajouter</Text></Button>
      </Card>
      {tasks.length ? (
        <>
          <Text style={styles.sectionLabel}>Aujourd'hui</Text>
          {todayTasks.length ? todayTasks.map(renderTask) : <EmptyState title="Rien pour aujourd'hui" subtitle="Les autres tâches restent visibles plus bas." />}
          <Text style={styles.sectionLabel}>À venir et en retard</Text>
          {otherTasks.length ? otherTasks.map(renderTask) : <Text style={uiStyles.muted}>Aucune autre tâche.</Text>}
        </>
      ) : <EmptyState title="Aucune tâche" subtitle="Ajoutez une tâche manuelle ou créez-en depuis le chat." />}
    </Screen>
  );
}

export function GoalsScreen({ navigation }: { navigation: Nav }) {
  const loader = useLoader<Goal[]>(() => goalsApi.list());
  const todayLoader = useLoader<GoalTodaySummary[]>(() => goalsApi.today());
  if ((loader.loading && !loader.data) || (todayLoader.loading && !todayLoader.data)) return <Screen><LoadingState /></Screen>;
  const summaries = new Map((todayLoader.data ?? []).map((item) => [item.goal_id, item]));
  return (
    <Screen refreshing={loader.loading || todayLoader.loading} onRefresh={() => { void loader.load(); void todayLoader.load(); }}>
      <SectionTitle title="Objectifs" subtitle="Suivez vos habitudes et vos efforts." right={<Button onPress={() => navigation.navigate("NewGoal")} style={{ minHeight: 42 }}><Plus color={colors.onPrimary} size={18} /></Button>} />
      <ErrorBanner message={loader.error || todayLoader.error} onRetry={() => { void loader.load(); void todayLoader.load(); }} />
      {loader.data?.length ? loader.data.map((goal) => {
        const summary = summaries.get(goal.id);
        return (
          <Pressable key={goal.id} onPress={() => navigation.navigate("GoalDetails", { goalId: goal.id })}>
            <Card style={styles.gapCard}>
              <View style={styles.spaceBetween}>
                <Text style={uiStyles.h2}>{goal.title}</Text>
                <Badge tone={summary?.achieved ? "success" : "primary"}>{summary?.completion_percentage ?? 0}%</Badge>
              </View>
              <Text style={uiStyles.muted}>
                Aujourd'hui: {summary?.today_value ?? 0} / {goal.target_value} {goal.unit}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(summary?.completion_percentage ?? 0, 100)}%` }]} />
              </View>
            </Card>
          </Pressable>
        );
      }) : <EmptyState title="Aucun objectif actif" subtitle="Créez un objectif simple pour démarrer." />}
    </Screen>
  );
}

export function NewGoalScreen({ navigation }: { navigation: Nav }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("fois");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    const targetValue = Number(target);
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0) {
      setError("Ajoutez un titre et une cible supérieure à zéro.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await goalsApi.create({ title: title.trim(), target_value: targetValue, unit: unit.trim() || "fois" });
      navigation.goBack();
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de créer l'objectif."));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen>
      <SectionTitle title="Nouvel objectif" />
      <ErrorBanner message={error} />
      <Card style={styles.gapCard}>
        <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Lire 20 pages" />
        <Field label="Cible" keyboardType="numeric" value={target} onChangeText={setTarget} />
        <Field label="Unité" value={unit} onChangeText={setUnit} placeholder="pages, minutes, fois..." />
        <Button loading={loading} disabled={!title.trim() || !Number(target)} onPress={submit}>Créer</Button>
      </Card>
    </Screen>
  );
}

export function GoalDetailsScreen({ route, navigation }: { route: { params: { goalId: string } }; navigation: Nav }) {
  const loader = useLoader<GoalWithProgress>(() => goalsApi.getById(route.params.goalId));
  const [value, setValue] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  const goal = loader.data;
  const log = async () => {
    if (!goal) return;
    const progressValue = Number(value);
    if (!Number.isFinite(progressValue) || progressValue <= 0) {
      loader.setError("La valeur doit être supérieure à zéro.");
      return;
    }
    setSaving(true);
    try {
      await goalsApi.logProgress({ goal_id: goal.id, value: progressValue, note: note.trim() || undefined });
      setNote("");
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible d'ajouter le progrès."));
    } finally {
      setSaving(false);
    }
  };
  const deactivate = async () => {
    if (!goal) return;
    setDeactivating(true);
    try {
      await goalsApi.deactivate(goal.id);
      navigation.goBack();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible de désactiver l'objectif."));
    } finally {
      setDeactivating(false);
    }
  };
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title={goal?.title ?? "Objectif"} subtitle={`${goal?.completion_percentage ?? 0}% complété`} />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      <Card style={styles.gapCard}>
        <Text style={styles.bigMetric}>{goal?.total_progress ?? 0} / {goal?.target_value ?? 0} {goal?.unit}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(goal?.completion_percentage ?? 0, 100)}%` }]} /></View>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Ajouter un progrès</Text>
        <Field label="Valeur" keyboardType="numeric" value={value} onChangeText={setValue} />
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optionnel" />
        <Button loading={saving} onPress={log}>Enregistrer</Button>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Historique</Text>
        {goal?.progress_history.length ? goal.progress_history.slice(0, 10).map((entry) => (
          <View key={entry.id} style={styles.listRow}>
            <Target color={colors.primary} size={18} />
            <Text style={uiStyles.muted}>{dateLabel(entry.date)} · {entry.value} {goal.unit}</Text>
          </View>
        )) : <Text style={uiStyles.muted}>Aucun progrès enregistré.</Text>}
      </Card>
      <Button loading={deactivating} variant="danger" onPress={deactivate}>
        <Trash2 color={colors.onPrimary} size={18} />
        Désactiver l'objectif
      </Button>
    </Screen>
  );
}

export function ModesScreen() {
  const loader = useLoader<ModeStats>(() => modesApi.stats());
  const [busy, setBusy] = useState(false);
  const current = loader.data?.current_session ?? null;
  const setMode = async (mode: Mode) => {
    setBusy(true);
    try {
      await modesApi.start(mode);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible de lancer le mode."));
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      await modesApi.stop();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible d'arrêter le mode."));
    } finally {
      setBusy(false);
    }
  };
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Modes" subtitle="Déclarez le contexte dans lequel vous êtes." />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {current ? (
        <Card style={styles.gapCard}>
          <Badge tone="success">Actif</Badge>
          <Text style={styles.modeActiveTitle}>{current.mode}</Text>
          <Button loading={busy} variant="danger" onPress={stop}>Arrêter</Button>
        </Card>
      ) : null}
      <View style={styles.modeGrid}>
        {modeOptions.map((mode) => (
          <Pressable key={mode} onPress={() => setMode(mode)} style={styles.modeTile}>
            <Text style={styles.modeTileText}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Cette semaine</Text>
        {(loader.data?.this_week ?? []).map((item) => (
          <View key={item.mode} style={styles.statRow}>
            <Text style={styles.listTitle}>{item.mode}</Text>
            <Text style={uiStyles.muted}>{item.total_minutes} min · {item.percentage}%</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

export function ResourcesScreen() {
  const [tab, setTab] = useState<"me" | "all">("me");
  const loader = useLoader<Resource[]>(() => (tab === "me" ? resourcesApi.getForMe() : resourcesApi.list()), [tab]);
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Ressources" subtitle="Des contenus adaptés à votre état du moment." />
      <View style={styles.choiceWrap}>
        <Pressable onPress={() => setTab("me")} style={[styles.choice, tab === "me" && styles.choiceActive]}><Text style={[styles.choiceText, tab === "me" && styles.choiceTextActive]}>Pour moi</Text></Pressable>
        <Pressable onPress={() => setTab("all")} style={[styles.choice, tab === "all" && styles.choiceActive]}><Text style={[styles.choiceText, tab === "all" && styles.choiceTextActive]}>Toutes</Text></Pressable>
      </View>
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((resource) => {
        const Icon = resource.type === "VIDEO" ? Video : resource.type === "ARTICLE" ? FileText : Dumbbell;
        return (
          <Pressable key={resource.id} onPress={() => Linking.openURL(resource.url)}>
            <Card style={styles.resourceCard}>
              <View style={styles.rowIcon}><Icon color={colors.primary} size={20} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{resource.title}</Text>
                <Text style={uiStyles.muted}>{resource.description ?? resource.category}</Text>
                <View style={styles.badgeRow}><Badge tone="primary">{resource.type}</Badge>{resource.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}</View>
              </View>
            </Card>
          </Pressable>
        );
      }) : <EmptyState title="Aucune ressource" />}
    </Screen>
  );
}

export function NotificationsScreen() {
  const loader = useLoader<Notification[]>(() => notificationsApi.list({ limit: 50 }));
  const markAll = async () => {
    try {
      await notificationsApi.readAll();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible de marquer les notifications."));
    }
  };
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Notifications" right={<Button variant="secondary" onPress={markAll} style={{ minHeight: 42 }}>Tout lu</Button>} />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((item) => (
        <Pressable key={item.id} onPress={() => { void notificationsApi.markRead(item.id); void loader.load(); }}>
          <Card style={[styles.gapCard, !item.is_read && styles.unreadCard]}>
            <View style={styles.spaceBetween}>
              <Text style={uiStyles.h3}>{item.title}</Text>
              {!item.is_read ? <Badge tone="primary">Nouveau</Badge> : null}
            </View>
            <Text style={uiStyles.muted}>{item.body}</Text>
          </Card>
        </Pressable>
      )) : <EmptyState title="Aucune notification" />}
    </Screen>
  );
}

export function ProfileScreen() {
  const { student, refreshStudent, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoBusy(true);
    setError("");
    try {
      await filesApi.uploadMyPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "profile.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      await refreshStudent();
      setMessage("Photo mise à jour.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de téléverser la photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const deletePhoto = async () => {
    setPhotoBusy(true);
    setError("");
    try {
      await filesApi.deleteMyPhoto();
      await refreshStudent();
      setMessage("Photo supprimée.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de supprimer la photo."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const changePassword = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await authApi.changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword("");
      setNewPassword("");
      setMessage("Mot de passe modifié avec succès.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de modifier le mot de passe."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionTitle title="Profil" subtitle="Vos informations étudiant et votre sécurité." />
      <ErrorBanner message={error} />
      {message ? <Card style={[styles.gapCard, { backgroundColor: colors.successSoft }]}><Text style={{ color: colors.success, fontWeight: "800" }}>{message}</Text></Card> : null}
      <Card style={styles.gapCard}>
        <Pressable onPress={pickPhoto} style={styles.profileHeader}>
          {student?.photo_url ? <Image source={{ uri: student.photo_url }} style={styles.avatar} /> : <View style={styles.avatar}><User color={colors.primary} size={34} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={uiStyles.h2}>{student?.first_name} {student?.last_name}</Text>
            <Text style={uiStyles.muted}>CNE : {student?.cne}</Text>
            <Text style={uiStyles.muted}>{student?.class_name ?? "Classe non définie"}</Text>
          </View>
        </Pressable>
        <View style={styles.inlineActions}>
          <Button loading={photoBusy} variant="secondary" onPress={pickPhoto} style={styles.inlineActionButton}>Changer la photo</Button>
          {student?.photo_url ? <Button loading={photoBusy} variant="ghost" onPress={deletePhoto} style={styles.inlineActionButton}>Supprimer</Button> : null}
        </View>
      </Card>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Changer le mot de passe</Text>
        <Field label="Ancien mot de passe" secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
        <Field label="Nouveau mot de passe" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <Button loading={loading} disabled={!oldPassword || newPassword.length < 8} onPress={changePassword}>Modifier</Button>
      </Card>
      <Button variant="danger" onPress={() => { void logout(); }}>Se déconnecter</Button>
    </Screen>
  );
}

export function AgentChatScreen() {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    { role: "assistant", content: "Bonjour, je suis Mizan AI. Vous pouvez écrire ou dicter ce que vous avez en tête." },
  ]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ChatTaskSuggestion[]>([]);
  const [createdSuggestionText, setCreatedSuggestionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startRecording = async () => {
    if (recording) return;
    setError("");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("Autorisez le micro pour enregistrer votre voix.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: nextRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(nextRecording);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de démarrer l'enregistrement."));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsTranscribing(true);
    setError("");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) return;
      const res = await voiceApi.transcribe({
        uri,
        name: `voice-chat-${Date.now()}.m4a`,
        type: "audio/m4a",
      });
      setInput((prev) => prev + (prev ? " " : "") + res.transcription);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de transcrire l'audio."));
    } finally {
      setIsTranscribing(false);
    }
  };

  const scrollRef = useRef<ScrollView>(null);

  const playAudioBase64 = async (base64: string) => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          void sound.unloadAsync();
        }
      });
    } catch {
      // Audio playback failed silently – text is still shown
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError("");
    setSuggestions([]);
    setCreatedSuggestionText("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Try voice chat first (returns text + TTS audio)
      const voiceRes = await voiceApi.chat({ user_text: text, history });
      setMessages((prev) => [...prev, { role: "assistant", content: voiceRes.agent_text }]);
      if (voiceRes.agent_audio_base64) {
        void playAudioBase64(voiceRes.agent_audio_base64);
      }
      // Still suggest tasks
      try {
        const suggested = await tasksApi.suggestFromChat({ user_message: text, assistant_message: voiceRes.agent_text });
        setSuggestions(suggested.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    } catch {
      // Fallback to text-only agent chat
      try {
        const res = await agentApi.chat(text);
        setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
        try {
          const suggested = await tasksApi.suggestFromChat({ user_message: text, assistant_message: res.response });
          setSuggestions(suggested.suggestions ?? []);
        } catch {
          setSuggestions([]);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Impossible de joindre Mizan AI."));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Je n'arrive pas à joindre l'agent backend pour l'instant. Les tâches, objectifs, modes et check-ins restent utilisables dans l'application.",
          },
        ]);
      }
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const createSuggestedTasks = async () => {
    const tasks = suggestions
      .map((item) => ({ title: item.title.trim(), description: item.description ?? undefined, due_date: todayIso(), source: "chat" as const }))
      .filter((item) => item.title);
    if (!tasks.length) return;
    setTaskLoading(true);
    setError("");
    try {
      await tasksApi.createMany({ tasks });
      setCreatedSuggestionText(`${tasks.length} tâche(s) créée(s) depuis le chat.`);
      setSuggestions([]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Impossible de créer les tâches proposées."));
    } finally {
      setTaskLoading(false);
    }
  };

  return (
    <Screen scroll={false}>
      <SectionTitle title="Mizan AI" subtitle="Conversation écrite ou dictée, avec réponse audio quand disponible." />
      <ErrorBanner message={error} />

      {recording || isTranscribing ? (
        <View style={styles.voiceChatStatus}>
          <View style={styles.recordingDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceChatStatusTitle}>{recording ? "Micro ouvert" : "Transcription en cours"}</Text>
            <Text style={styles.voiceChatStatusSub}>
              {recording ? "Parlez librement, puis arrêtez pour envoyer le texte vers l'entrée." : "Le backend convertit l'audio en message."}
            </Text>
          </View>
          <VoiceBars active />
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.chatList} contentContainerStyle={styles.chatListContent}>
        {messages.map((message, index) => (
          <View
            key={`${message.role}-${index}`}
            style={[
              styles.bubble,
              message.role === "user" ? styles.userBubble : styles.assistantBubble,
              message.role === "assistant" && styles.voiceAssistantBubble,
            ]}
          >
            {message.role === "assistant" ? (
              <View style={styles.voiceBubbleHeader}>
                <VoiceOrb active={loading && index === messages.length - 1} size={30} />
                <Text style={styles.voiceBubbleLabel}>Mizan AI vocal</Text>
              </View>
            ) : null}
            <Text style={message.role === "user" ? styles.userBubbleText : styles.assistantBubbleText}>{message.content}</Text>
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, styles.assistantBubble, styles.voiceAssistantBubble, { paddingVertical: spacing.lg }]}>
            <View style={styles.voiceBubbleHeader}>
              <VoiceOrb active size={30} />
              <Text style={styles.voiceBubbleLabel}>Mizan écoute le contexte</Text>
            </View>
            <VoiceBars active />
          </View>
        ) : null}
        {createdSuggestionText ? <Text style={styles.successText}>{createdSuggestionText}</Text> : null}
        {suggestions.length ? (
          <Card style={styles.suggestionCard}>
            <Text style={uiStyles.h3}>Tâches proposées</Text>
            {suggestions.map((item) => <Text key={item.title} style={styles.bullet}>• {item.title}</Text>)}
            <Button loading={taskLoading} variant="secondary" onPress={createSuggestedTasks}>Créer les tâches</Button>
          </Card>
        ) : null}
      </ScrollView>
      <View style={styles.chatComposer}>
        <View style={[styles.chatInputWrap, recording && styles.chatInputWrapRecording]}>
          <View style={styles.chatInputLeading}>
            <VoiceOrb active={Boolean(recording || isTranscribing)} danger={Boolean(recording)} size={34} />
          </View>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={recording ? "Enregistrement en cours..." : isTranscribing ? "Transcription..." : "Écrire ou dicter un message..."}
            placeholderTextColor="rgba(110,115,125,0.65)"
            style={styles.chatInput}
            editable={!recording && !isTranscribing}
            onSubmitEditing={send}
            returnKeyType="send"
          />
        </View>
        {recording ? (
          <Pressable onPress={stopRecording} style={[styles.sendButton, styles.voiceStopButton]}>
            <Square color={colors.onPrimary} size={18} />
          </Pressable>
        ) : !input.trim() ? (
          <Pressable onPress={startRecording} disabled={loading || isTranscribing} style={[styles.sendButton, styles.voiceMicButton, (loading || isTranscribing) && styles.sendButtonDisabled]}>
            <Mic color={colors.onPrimary} size={18} />
          </Pressable>
        ) : (
          <Pressable onPress={send} disabled={loading || isTranscribing} style={[styles.sendButton, (loading || isTranscribing) && styles.sendButtonDisabled]}>
            <Send color={colors.onPrimary} size={18} />
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

export function AgentContractsScreen() {
  const loader = useLoader<AgentActionContract[]>(() => agentApi.listContracts({ limit: 30 }));
  const respond = async (contract: AgentActionContract, accepted: boolean) => {
    try {
      await agentApi.respondContract(contract.id, accepted);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible de répondre au contrat."));
    }
  };
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Contrats agent" subtitle="Engagements proposés par Mizan AI." />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((contract) => (
        <Card key={contract.id} style={styles.gapCard}>
          <View style={styles.spaceBetween}><Badge tone="primary">{contract.adaptive_level}</Badge><Badge>{contract.status}</Badge></View>
          <Text style={uiStyles.h3}>{contract.contract_text}</Text>
          {contract.status === "pending" ? (
            <View style={styles.metricRow}>
              <Button variant="secondary" onPress={() => respond(contract, false)} style={{ flex: 1 }}>Décliner</Button>
              <Button onPress={() => respond(contract, true)} style={{ flex: 1 }}>Accepter</Button>
            </View>
          ) : null}
        </Card>
      )) : <EmptyState title="Aucun contrat" />}
    </Screen>
  );
}

export function AgentScenariosScreen() {
  const loader = useLoader<AgentTestRun[]>(() => agentApi.listTestRuns());
  const trigger = async () => {
    try {
      await agentApi.triggerTestRun({ event_type: "manual_mobile", note: "Triggered from React Native app" });
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Impossible de lancer le scénario."));
    }
  };
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Scénarios agent" subtitle="Tests d'orchestration côté backend." right={<Button onPress={trigger} style={{ minHeight: 42 }}>Tester</Button>} />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((run) => (
        <Card key={run.id} style={styles.gapCard}>
          <View style={styles.spaceBetween}><Badge tone="purple">{run.trigger_type}</Badge><Badge>{run.status}</Badge></View>
          <Text style={uiStyles.muted}>{run.reasoning_summary ?? "Aucun résumé."}</Text>
          <Text style={uiStyles.muted}>{new Date(run.created_at).toLocaleString()}</Text>
        </Card>
      )) : <EmptyState title="Aucun scénario" />}
    </Screen>
  );
}

export function HistoryScreen() {
  const loader = useLoader(() => checkinsApi.history(14));
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Historique" subtitle="Vos check-ins récents." />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      <Card style={styles.gapCard}>
        <View style={styles.metricRow}>
          <Metric label="Humeur matin" value={loader.data?.averages.morning_mood.toFixed(1) ?? "-"} />
          <Metric label="Sommeil" value={loader.data?.averages.sleep_hours.toFixed(1) ?? "-"} tone="purple" />
        </View>
      </Card>
      {[...(loader.data?.morning_checkins ?? []), ...(loader.data?.evening_checkins ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20)
        .map((item) => (
          <Card key={item.id} style={styles.gapCard}>
            <View style={styles.spaceBetween}>
              <Text style={uiStyles.h3}>{dateLabel(item.date)}</Text>
              <Badge tone="primary">{item.mood_score}/5</Badge>
            </View>
            <Text style={uiStyles.muted}>{item.executive_summary ?? "Sans résumé."}</Text>
          </Card>
        ))}
    </Screen>
  );
}

export function WeeklyReportScreen() {
  const loader = useLoader<WeeklyReport>(() => analyticsApi.weeklyReport());
  if (loader.loading && !loader.data) return <Screen><LoadingState /></Screen>;
  return (
    <Screen refreshing={loader.loading} onRefresh={loader.load}>
      <SectionTitle title="Rapport hebdo" subtitle={`${loader.data?.week_start ?? ""} → ${loader.data?.week_end ?? ""}`} />
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      <View style={styles.metricRow}>
        <Metric label="Humeur moy." value={loader.data?.avg_mood.toFixed(1) ?? "-"} />
        <Metric label="Sommeil moy." value={loader.data?.avg_sleep.toFixed(1) ?? "-"} tone="purple" />
      </View>
      <View style={styles.metricRow}>
        <Metric label="Check-ins" value={loader.data?.total_checkins ?? 0} tone="success" />
        <Metric label="Objectifs atteints" value={loader.data?.goals_achieved ?? 0} tone="warning" />
      </View>
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Répartition modes</Text>
        {loader.data?.mode_distribution.map((item) => (
          <View key={item.mode} style={styles.statRow}>
            <Text style={styles.listTitle}>{item.mode}</Text>
            <Text style={uiStyles.muted}>{item.total_minutes} min · {item.percentage}%</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

export function MoreScreen({ navigation }: { navigation: Nav }) {
  const { student } = useAuth();
  const backend = useLoader<DetailedHealthResponse>(() => healthApi.detailed());
  const backendOnline = backend.data?.status === "ok" && backend.data.database === "connected";

  return (
    <Screen refreshing={backend.loading} onRefresh={backend.load}>
      <SectionTitle title="Plus" subtitle={`${student?.first_name ?? "Mizan"} · tout en un coup d'œil`} />
      <ErrorBanner message={backend.error} onRetry={backend.load} />

      <Card style={styles.gapCard}>
        <View style={styles.spaceBetween}>
          <Text style={uiStyles.h2}>Backend</Text>
          <Badge tone={backendOnline ? "success" : backend.loading ? "warning" : "danger"}>
            {backendOnline ? "Connecté" : backend.loading ? "Vérification" : "Hors ligne"}
          </Badge>
        </View>
        <Text style={uiStyles.muted}>{API_ORIGIN}</Text>
        <View style={styles.metricRow}>
          <Metric label="Base de données" value={backend.data?.database ?? "-"} tone={backendOnline ? "success" : "warning"} />
          <Metric label="Services" value={backend.data?.services.length ?? 0} tone="primary" />
        </View>
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Suivi</Text>
        <RowAction icon={Target} title="Objectifs" subtitle="Habitudes et efforts." onPress={() => navigation.navigate("Goals")} />
        <RowAction icon={Clock3} title="Modes" subtitle="Focus, révision, repos..." onPress={() => navigation.navigate("Modes")} />
        <RowAction icon={History} title="Historique" subtitle="Check-ins passés." onPress={() => navigation.navigate("History")} />
        <RowAction icon={FileText} title="Rapport hebdo" subtitle="Synthèse de la semaine." onPress={() => navigation.navigate("WeeklyReport")} />
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Agent IA</Text>
        <RowAction icon={ShieldCheck} title="Contrats agent" subtitle="Engagements Mizan AI." onPress={() => navigation.navigate("AgentContracts")} />
        <RowAction icon={Sparkles} title="Scénarios agent" subtitle="Tests d'orchestration." onPress={() => navigation.navigate("AgentScenarios")} />
        <RowAction icon={BookOpen} title="Ressources" subtitle="Contenus adaptés." onPress={() => navigation.navigate("Resources")} />
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Compte</Text>
        <RowAction icon={Bell} title="Notifications" subtitle="Toutes vos alertes." onPress={() => navigation.navigate("Notifications")} />
        <RowAction icon={User} title="Profil" subtitle="Photo, mot de passe." onPress={() => navigation.navigate("Profile")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleIcon: {
    borderRadius: radius.md,
    height: 46,
    width: 46,
  },
  gapCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  modeBanner: {
    backgroundColor: colors.primary,
    borderColor: "transparent",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modeBannerTitle: {
    color: colors.onPrimary,
    fontSize: 30,
    fontWeight: "900",
  },
  modeBannerMeta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "700",
  },
  modeActiveTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  quickButton: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 62,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  barWrap: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
  },
  barTrack: {
    backgroundColor: "rgba(194, 198, 211, 0.22)",
    borderRadius: 999,
    height: 90,
    justifyContent: "flex-end",
    width: 14,
    overflow: "hidden",
  },
  bar: {
    borderRadius: 999,
    width: "100%",
  },
  barLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  rowAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderBottomColor: "rgba(194,198,211,0.24)",
    borderBottomWidth: 1,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowActionPressed: {
    transform: [{ scale: 0.99 }],
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  moodRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  moodDot: {
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderColor: "rgba(194,198,211,0.28)",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: "center",
  },
  moodDotActive: {
    backgroundColor: colors.primary,
  },
  moodText: {
    color: colors.text,
    fontWeight: "900",
  },
  moodTextActive: {
    color: colors.onPrimary,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  choice: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.28)",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceActive: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  choiceTextActive: {
    color: colors.onPrimary,
  },
  bullet: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  taskCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  editingTaskCard: {
    borderColor: colors.primary,
  },
  taskCheck: {
    paddingTop: 2,
  },
  doneText: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
  },
  taskActions: {
    alignItems: "center",
    gap: spacing.xs,
  },
  editForm: {
    gap: spacing.md,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlineActionButton: {
    flexGrow: 1,
    minHeight: 44,
  },
  buttonInline: {
    color: colors.onPrimary,
    fontWeight: "900",
  },
  spaceBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  progressTrack: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: "100%",
  },
  bigMetric: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modeTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.22)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 86,
    justifyContent: "center",
    ...shadow,
  },
  modeTileText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  statRow: {
    borderBottomColor: "rgba(194,198,211,0.24)",
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  resourceCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  unreadCard: {
    borderColor: colors.primary,
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  suggestionCard: {
    gap: spacing.md,
    marginTop: spacing.sm,
    shadowOpacity: 0,
  },
  bubble: {
    borderRadius: radius.md,
    maxWidth: "86%",
    padding: spacing.md,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderWidth: 1,
  },
  userBubbleText: {
    color: colors.onPrimary,
    fontSize: 15,
    lineHeight: 21,
  },
  assistantBubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  chatComposer: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.34)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadow,
  },
  chatInputWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.26)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingLeft: spacing.sm,
  },
  chatInputWrapRecording: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(179,38,30,0.36)",
  },
  chatInputLeading: {
    marginRight: spacing.sm,
  },
  chatInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    minHeight: 52,
    paddingRight: spacing.md,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  voiceMicButton: {
    backgroundColor: colors.primaryDark,
  },
  voiceStopButton: {
    backgroundColor: colors.danger,
  },
  voiceAssistantBubble: {
    gap: spacing.sm,
  },
  voiceBubbleHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  voiceBubbleLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  voiceChatStatus: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(0,92,174,0.18)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  voiceChatStatusTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  voiceChatStatusSub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  voiceCheckinButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.xl,
    borderColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 84,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  voiceCheckinTitle: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "900",
  },
  voiceCheckinSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  voiceOrbWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  voiceOrbPulse: {
    borderRadius: 999,
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  voiceOrb: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    height: "82%",
    justifyContent: "center",
    width: "82%",
  },
  voiceBars: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 42,
  },
  voiceBar: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    width: 5,
  },
  voiceSessionCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(0,92,174,0.16)",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  voiceSessionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  voiceSessionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  voiceSessionSub: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  voicePeriodSwitch: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  voicePeriodButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  voicePeriodButtonActive: {
    backgroundColor: colors.primary,
  },
  voicePeriodText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  voicePeriodTextActive: {
    color: colors.onPrimary,
  },
  voicePrimaryAction: {
    minHeight: 52,
  },
  voicePressed: {
    transform: [{ scale: 0.98 }],
  },
  voiceLiveStrip: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(179,38,30,0.22)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  voiceLiveText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
  },
  voiceQuestionCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  voiceQuestionCardActive: {
    borderColor: colors.danger,
  },
  voiceCurrentRecorder: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(0,92,174,0.14)",
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  voiceMainRecordButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  voiceMainRecordButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  voiceCurrentActionText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: spacing.sm,
  },
  voiceCurrentHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  voiceCurrentTranscript: {
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.24)",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  voiceQuestionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  voiceQuestionNumber: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  voiceQuestionNumberText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  voiceQuestionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  voiceQuestionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  voiceTranscriptInput: {
    backgroundColor: colors.surfaceLow,
    minHeight: 94,
    textAlignVertical: "top",
  },
  voiceRecordButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(0,92,174,0.18)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  voiceRecordButtonActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  voiceRecordTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  voiceRecordTitleActive: {
    color: colors.onPrimary,
  },
  voiceRecordSub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  voiceRecordSubActive: {
    color: "rgba(255,255,255,0.78)",
  },
  voiceAnalysisCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  voiceTranscriptStack: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  voiceTranscriptRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.18)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  voiceTranscriptRowActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(0,92,174,0.22)",
  },
  voiceTranscriptQuestion: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  voiceTranscriptPreview: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  ritualHero: {
    backgroundColor: colors.primaryDark,
    borderColor: "rgba(255,255,255,0.18)",
    gap: spacing.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  ritualHeroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  ritualHeroMark: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  ritualHeroEyebrow: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  ritualHeroTitle: {
    color: colors.onPrimary,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
  },
  ritualProgressTrack: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
  },
  ritualProgressFill: {
    backgroundColor: colors.onPrimary,
    borderRadius: 999,
    height: "100%",
  },
  ritualHeroMetrics: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  ritualHeroMetric: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 66,
    padding: spacing.sm,
  },
  ritualHeroMetricLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  ritualHeroMetricValue: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  ritualVoicePanel: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 118,
    padding: spacing.lg,
    ...shadow,
  },
  ritualVoiceLeft: {
    alignItems: "center",
    gap: spacing.xs,
  },
  ritualVoiceTitle: {
    color: colors.onPrimary,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 26,
  },
  ritualVoiceSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  ritualPath: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  ritualStepCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.26)",
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 84,
    padding: spacing.md,
    ...shadow,
  },
  ritualStepCardDone: {
    backgroundColor: colors.successSoft,
    borderColor: "rgba(5,150,105,0.24)",
  },
  ritualStepIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  ritualStepIconDone: {
    backgroundColor: colors.surface,
  },
  ritualStepTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  ritualStepSub: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  ritualInsightCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  ritualPriorityRow: {
    alignItems: "flex-start",
    borderTopColor: "rgba(194,198,211,0.22)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  ritualPriorityIndex: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 22,
    width: 22,
  },
  ritualPriorityText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  ritualContextCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    shadowOpacity: 0,
  },
  ritualContextRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  ritualContextTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 2,
  },
  checkinRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  checkinCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    borderColor: "rgba(194,198,211,0.28)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minHeight: 110,
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  checkinCardDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  checkinCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  // ── Recording indicator ──
  recordingIndicator: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  recordingDot: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  recordingText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },
});
