import React from "react";
import { Text, View } from "react-native";
import {
  Bell,
  BookOpen,
  Clock3,
  FileText,
  History,
  ShieldCheck,
  Sparkles,
  Target,
  User,
} from "lucide-react-native";
import { Screen } from "../../../components/screen";
import { Card, styles as uiStyles } from "../../../components/ui";
import { styles } from "../styles";
import type { Nav } from "../types";
import { RowAction } from "../components";

export function MoreScreen({ navigation }: { navigation: Nav }) {
  return (
    <Screen variant="tab">
      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Tracking</Text>
        <RowAction icon={Target} title="Goals" subtitle="Habits and efforts." onPress={() => navigation.navigate("Goals")} />
        <RowAction icon={Clock3} title="Modes" subtitle="Focus, revision, rest..." onPress={() => navigation.navigate("Modes")} />
        <RowAction icon={History} title="History" subtitle="Past check-ins." onPress={() => navigation.navigate("History")} />
        <RowAction icon={FileText} title="Weekly report" subtitle="Summary of the week." onPress={() => navigation.navigate("WeeklyReport")} />
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>AI Agent</Text>
        <RowAction icon={ShieldCheck} title="Agent contracts" subtitle="Mizan AI commitments." onPress={() => navigation.navigate("AgentContracts")} />
        {__DEV__ ? (
          <RowAction icon={Sparkles} title="Agent scenarios" subtitle="Orchestration tests." onPress={() => navigation.navigate("AgentScenarios")} />
        ) : null}
        <RowAction icon={BookOpen} title="Resources" subtitle="Curated content." onPress={() => navigation.navigate("Resources")} />
      </Card>

      <Card style={styles.gapCard}>
        <Text style={uiStyles.h2}>Account</Text>
        <RowAction icon={Bell} title="Notifications" subtitle="All your alerts." onPress={() => navigation.navigate("Notifications")} />
        <RowAction icon={User} title="Profile" subtitle="Photo, password." onPress={() => navigation.navigate("Profile")} />
      </Card>
    </Screen>
  );
}
