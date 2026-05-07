import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 20, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(ring1, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ]).start();

    const timer = setTimeout(() => router.replace("/auth"), 2800);
    return () => clearTimeout(timer);
  }, []);

  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 3.0] });

  return (
    <LinearGradient colors={["#035a66", "#047382", "#05909f"]} style={styles.container} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
      <Animated.View style={[styles.ring, { opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: ring1Scale }] }]} />
      <Animated.View style={[styles.ring, { opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }), transform: [{ scale: ring2Scale }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconRing}>
            <Ionicons name="medical" size={52} color="#047382" />
          </View>
        </View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
          <Text style={styles.appName}>MedRemind</Text>
          <Text style={styles.tagline}>Never miss a dose again</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  content: { alignItems: "center" },
  iconWrapper: { marginBottom: 28 },
  iconRing: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 15 },
  appName: { fontSize: 38, fontWeight: "800", color: "#fff", textAlign: "center", letterSpacing: 1 },
  tagline: { fontSize: 16, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 8, letterSpacing: 0.5 },
  footer: { position: "absolute", bottom: 60 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { width: 24, backgroundColor: "#fff" },
});
