import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  Heart,
  Moon,
  Trophy,
} from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { getApiErrorMessage, notificationsApi } from "../../../lib/api";
import { notificationTarget } from "../../../lib/agent-commitments";
import type { Notification } from "../../../lib/types";
import type { MainStackParamList } from "../../../navigation/types";
import { colors, spacing } from "../../../theme";
import { styles } from "../styles";
import { useLoader } from "../hooks/useLoader";

function NotificationIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const size = 20;
  if (t.includes("exam")) return <Calendar color={colors.danger} size={size} />;
  if (t.includes("sleep")) return <Moon color={colors.primary} size={size} />;
  if (t.includes("sport")) return <Trophy color={colors.success} size={size} />;
  if (t.includes("wellbeing") || t.includes("stress")) return <Heart color={colors.warning} size={size} />;
  if (t.includes("overdue")) return <AlertTriangle color={colors.danger} size={size} />;
  if (t.includes("resource")) return <BookOpen color={colors.primary} size={size} />;
  return <Bell color={colors.primary} size={size} />;
}

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const loader = useLoader<Notification[]>(() => notificationsApi.list({ limit: 50 }));
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    try {
      await notificationsApi.sendTest();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not send test notification."));
    } finally {
      setTesting(false);
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.readAll();
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not mark notifications as read."));
    }
  };

  const onTap = async (item: Notification) => {
    try {
      if (!item.is_read) await notificationsApi.markRead(item.id);
      const target = notificationTarget(item.payload ?? undefined);
      if (target?.screen === "AgentContracts") {
        navigation.navigate("AgentContracts", target.params);
      } else if (target?.screen === "Tasks") {
        navigation.navigate("Tabs");
      }
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not open notification."));
    }
  };

  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;

  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginBottom: spacing.sm }}>
        <Button loading={testing} onPress={() => void sendTest()} style={{ minHeight: 38 }}>
          Test alert
        </Button>
        <Button variant="secondary" onPress={markAll} style={{ minHeight: 38 }}>
          Read all
        </Button>
      </View>
      <ErrorBanner message={loader.error} onRetry={loader.load} />
      {loader.data?.length ? loader.data.map((item) => (
        <Pressable key={item.id} onPress={() => void onTap(item)}>
          <Card style={[styles.gapCard, !item.is_read && styles.unreadCard]}>
            <View style={[styles.listRow, { alignItems: "flex-start" }]}>
              <NotificationIcon type={item.type} />
              <View style={{ flex: 1 }}>
                <Text style={uiStyles.h3}>{item.title}</Text>
                <Text style={uiStyles.muted}>{item.body}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      )) : <EmptyState title="No notifications" />}
    </Screen>
  );
}
