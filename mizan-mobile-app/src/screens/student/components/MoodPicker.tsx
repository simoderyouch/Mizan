import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "../styles";

export function MoodPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
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
