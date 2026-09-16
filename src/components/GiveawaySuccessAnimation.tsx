import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface GiveawaySuccessAnimationProps {
  onComplete: () => void;
}

export default function GiveawaySuccessAnimation({ onComplete }: GiveawaySuccessAnimationProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bgColors = useRef(new Animated.Value(0)).current;

  // Floating particles
  const particles = useRef(
    Array.from({ length: 15 }).map(() => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(height + 100),
      scale: Math.random() * 0.5 + 0.5,
      delay: Math.random() * 2000,
    }))
  ).current;

  useEffect(() => {
    // 1. Fade in and dramatic scale up
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: false }),
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();

    // 2. Continuous rotation of background sunburst
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();

    // 3. Color pulsing
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgColors, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(bgColors, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();

    // 4. Particle floating
    particles.forEach(p => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.y, {
            toValue: -100,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          })
        ])
      ).start();
    });

    // 5. End after 10 seconds
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }).start(() => onComplete());
    }, 10000);
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const bgColorInterpolate = bgColors.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(99, 102, 241, 0.9)", "rgba(236, 72, 153, 0.95)"], // Indigo to Pink
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColorInterpolate, opacity }]}>
      
      {/* Spinning Sunburst */}
      <Animated.View style={[styles.sunburst, { transform: [{ rotate: rotateInterpolate }, { scale: 2 }] }]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 30}deg` }] }]} />
        ))}
      </Animated.View>

      {/* Particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            { transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }] }
          ]}
        >
          <Ionicons name="star" size={24} color="#FFF" />
        </Animated.View>
      ))}

      {/* Main Content */}
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <Ionicons name="flash" size={80} color="#FBBF24" style={styles.icon} />
        <Text style={styles.title}>COMBO UNLOCKED!</Text>
        <Text style={styles.subtitle}>You just got 3 premium courses.</Text>
        
        <View style={styles.glowBox}>
          <Text style={styles.glowText}>NEW SKILLS ACQUIRED</Text>
        </View>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill as object,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sunburst: {
    position: "absolute",
    width: width,
    height: width,
    alignItems: "center",
    justifyContent: "center",
  },
  ray: {
    position: "absolute",
    width: 40,
    height: "200%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  particle: {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0.8,
  },
  content: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  icon: {
    marginBottom: 20,
    textShadowColor: "rgba(251, 191, 36, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: "#E2E8F0",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "600",
  },
  glowBox: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  glowText: {
    color: "#FBBF24",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 1,
  },
});
