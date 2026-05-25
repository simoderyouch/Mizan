import { Platform, type ViewStyle } from "react-native";

export const colors = {
  background: "#FCF9F8",
  backgroundAlt: "#F6F3F2",
  surface: "#FFFFFF",
  surfaceLow: "#F6F3F2",
  surfaceHigh: "#E5E2E0",
  text: "#1C1B1B",
  muted: "#424751",
  outline: "#C2C6D3",
  primary: "#005CAE",
  primaryDark: "#004584",
  primarySoft: "#D5E3FF",
  onPrimary: "#FFFFFF",
  success: "#059669",
  successSoft: "#ECFDF5",
  danger: "#B3261E",
  dangerSoft: "#FCEEEE",
  warning: "#B26A00",
  warningSoft: "#FFF4D6",
  accent: "#4090FF",
  accentSoft: "#E8F0FF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
};

export const shadow: ViewStyle =
  Platform.OS === "web"
    ? { boxShadow: "0px 8px 24px rgba(28, 27, 27, 0.04)" }
    : {
        shadowColor: "#1C1B1B",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 24,
        elevation: 2,
      };
