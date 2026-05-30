import React from "react";
import { View } from "react-native";
import { styles } from "../styles";

export function VoiceBars({ active }: { active: boolean }) {
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
