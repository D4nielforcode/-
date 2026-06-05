import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Alert,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { pickFortune } from "./fortunes";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SHAKE_THRESHOLD = 2.2;
const COOLDOWN_MS = 2500;

export default function App() {
  const [fortune, setFortune] = useState(
    "핸드폰을 흔들면 오늘의 운세가 나옵니다 ✨"
  );
  const [listening, setListening] = useState(false);
  const [permissionOk, setPermissionOk] = useState(false);
  const lastShakeRef = useRef(0);
  const subRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (subRef.current) subRef.current.remove();
    };
  }, []);

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("알림 권한 필요", "푸쉬 알림을 받으려면 권한이 필요합니다.");
      return false;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("fortune", {
        name: "포춘쿠키",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 80, 60, 80],
        lightColor: "#ff5e7e",
      });
    }
    setPermissionOk(true);
    return true;
  };

  const animateShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0.6, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 120, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  };

  const fire = async () => {
    const now = Date.now();
    if (now - lastShakeRef.current < COOLDOWN_MS) return;
    lastShakeRef.current = now;
    const text = pickFortune();
    setFortune(text);
    animateShake();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🥠 오늘의 포춘쿠키",
        body: text,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "fortune" } : {}),
      },
      trigger: null,
    });
  };

  const startListening = async () => {
    if (!permissionOk) {
      const ok = await requestPermissions();
      if (!ok) return;
    }
    Accelerometer.setUpdateInterval(100);
    subRef.current = Accelerometer.addListener(({ x, y, z }) => {
      const force = Math.sqrt(x * x + y * y + z * z);
      if (force > SHAKE_THRESHOLD) fire();
    });
    setListening(true);
  };

  const stopListening = () => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    setListening(false);
  };

  const rotate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-15deg", "15deg"],
  });
  const translate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-12, 12],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>흔들어! 포춘쿠키 🥠</Text>

      <Animated.Text
        style={[
          styles.cookie,
          { transform: [{ rotate }, { translateX: translate }] },
        ]}
      >
        🥠
      </Animated.Text>

      <View style={styles.fortuneBox}>
        <Text style={styles.fortuneText}>{fortune}</Text>
      </View>

      <View style={styles.controls}>
        {!listening ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={startListening}>
            <Text style={styles.primaryBtnText}>🔔 알림 허용하고 시작하기</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { lastShakeRef.current = 0; fire(); }}>
              <Text style={styles.secondaryBtnText}>🥠 한 번 뽑기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={stopListening}>
              <Text style={styles.secondaryBtnText}>⏸ 중지</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.status}>
          {listening ? "흔들기 감지 중… 핸드폰을 흔들어보세요!" : "버튼을 눌러 시작하세요"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1033",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "600", opacity: 0.9 },
  cookie: { fontSize: 140 },
  fortuneBox: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    width: "100%",
    maxWidth: 420,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  fortuneText: { color: "#fff", fontSize: 18, lineHeight: 26, textAlign: "center" },
  controls: { width: "100%", maxWidth: 420, alignItems: "center", gap: 12 },
  primaryBtn: {
    backgroundColor: "#ff5e7e",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    width: "100%",
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, width: "100%" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  status: { color: "#fff", fontSize: 12, opacity: 0.5, marginTop: 4 },
});
