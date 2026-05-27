import { LogBox } from "react-native";

const ignoredMessages = ["props.pointerEvents is deprecated"];
const originalWarn = console.warn;

console.warn = (...args: unknown[]) => {
  const firstArg = String(args[0] ?? "");
  if (ignoredMessages.some((message) => firstArg.includes(message))) return;
  originalWarn(...args);
};

LogBox.ignoreLogs(ignoredMessages);
