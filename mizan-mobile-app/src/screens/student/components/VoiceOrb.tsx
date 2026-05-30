import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Mic, Square } from "lucide-react-native";
import { colors } from "../../../theme";
import { styles } from "../styles";

export function VoiceOrb({
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
        {danger ? (
          <Square color={colors.onPrimary} size={size * 0.34} />
        ) : (
          <Mic color={colors.onPrimary} size={size * 0.38} />
        )}
      </View>
    </View>
  );
}
