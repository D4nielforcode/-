import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

const Native = requireNativeModule("ShakeBg");

export async function startBackgroundShake(fortunes) {
  return Native.start(fortunes);
}

export async function stopBackgroundShake() {
  return Native.stop();
}

export async function isRunning() {
  return Native.isRunning();
}

export const supportsContinuousBackground = Platform.OS === "android";
