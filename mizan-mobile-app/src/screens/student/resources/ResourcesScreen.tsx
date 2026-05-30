import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Dumbbell, FileText, Video } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { resourcesApi } from "../../../lib/api";
import type { Resource } from "../../../lib/types";
import { colors } from "../../../theme";
import { styles } from "../styles";
import { useLoader } from "../hooks/useLoader";

export function ResourcesScreen() {
  const [tab, setTab] = useState<"me" | "all">("me");
  const loader = useLoader<Resource[]>(() => (tab === "me" ? resourcesApi.getForMe() : resourcesApi.list()), [tab]);
  
  if (loader.loading && !loader.data) return <Screen variant="stack"><LoadingState /></Screen>;
  
  return (
    <Screen variant="stack" refreshing={loader.loading} onRefresh={loader.load}>
      <View style={styles.choiceWrap}>
        <Pressable onPress={() => setTab("me")} style={[styles.choice, tab === "me" && styles.choiceActive]}><Text style={[styles.choiceText, tab === "me" && styles.choiceTextActive]}>For me</Text></Pressable>
        <Pressable onPress={() => setTab("all")} style={[styles.choice, tab === "all" && styles.choiceActive]}><Text style={[styles.choiceText, tab === "all" && styles.choiceTextActive]}>All</Text></Pressable>
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
      }) : <EmptyState title="No resources" />}
    </Screen>
  );
}
