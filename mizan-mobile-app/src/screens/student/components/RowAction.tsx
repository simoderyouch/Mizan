import React from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { styles as uiStyles } from "../../../components/ui";
import { colors } from "../../../theme";
import { styles } from "../styles";

export function RowAction({
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
