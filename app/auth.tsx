import { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const C = { primary: "#047382", primaryDark: "#035a66", text: "#1a2e35", textSub: "#6b8e95" };

export default function AuthScreen() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkBiometrics();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setHasBiometrics(hasHardware && isEnrolled);
  };

  const authenticate = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const hasBio = await LocalAuthentication.isEnrolledAsync();
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: hasHardware && hasBio ? "Use Face ID or Touch ID" : "Enter your PIN",
        fallbackLabel: "Use PIN",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (auth.success) {
        router.replace("/home");
      } else {
        setError("Authentication failed. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={[C.primaryDark, C.primary, "#058a9a"]} style={s.topSection} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={s.circle1} />
        <View style={s.circle2} />
        <Animated.View style={[s.topContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.iconContainer}>
            <Ionicons name="medical" size={44} color={C.primary} />
          </View>
          <Text style={s.appName}>MedRemind</Text>
          <Text style={s.subtitle}>Your health companion</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={s.welcomeText}>Welcome back 👋</Text>
        <Text style={s.instructionText}>
          {hasBiometrics ? "Authenticate to access your medications securely" : "Enter your PIN to continue"}
        </Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity style={[s.button, isAuthenticating && s.buttonDisabled]} onPress={authenticate} disabled={isAuthenticating} activeOpacity={0.85}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={s.buttonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name={hasBiometrics ? "finger-print-outline" : "keypad-outline"} size={22} color="white" />
              <Text style={s.buttonText}>{isAuthenticating ? "Verifying..." : hasBiometrics ? "Authenticate" : "Enter PIN"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        {error && (
          <View style={s.errorContainer}>
            <Ionicons name="alert-circle" size={18} color="#e53e3e" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        <View style={s.secureRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} />
          <Text style={s.secureText}>Your data is encrypted & secure</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9fa" },
  topSection: { height: "45%", justifyContent: "flex-end", paddingBottom: 50, alignItems: "center", overflow: "hidden" },
  circle1: { position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)" },
  circle2: { position: "absolute", top: 30, left: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: "rgba(255,255,255,0.05)" },
  topContent: { alignItems: "center" },
  iconContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  appName: { fontSize: 32, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  card: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, paddingTop: 36, marginTop: -24 },
  welcomeText: { fontSize: 26, fontWeight: "700", color: C.text, marginBottom: 8 },
  instructionText: { fontSize: 15, color: C.textSub, lineHeight: 22, marginBottom: 32 },
  button: { borderRadius: 16, overflow: "hidden", shadowColor: "#047382", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  buttonDisabled: { opacity: 0.7 },
  buttonGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 10 },
  buttonText: { color: "white", fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  errorContainer: { flexDirection: "row", alignItems: "center", marginTop: 20, padding: 14, backgroundColor: "#fff5f5", borderRadius: 12, gap: 8, borderLeftWidth: 3, borderLeftColor: "#e53e3e" },
  errorText: { color: "#e53e3e", fontSize: 14, flex: 1 },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 28, gap: 6 },
  secureText: { color: "#047382", fontSize: 13, fontWeight: "500" },
});
