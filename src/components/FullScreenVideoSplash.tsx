import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Easing,
  Platform,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("screen");

interface FullScreenVideoSplashProps {
  children: React.ReactNode;
  durationMs?: number;
}

export function FullScreenVideoSplash({
  children,
  durationMs = 3000,
}: FullScreenVideoSplashProps) {
  const [isAnimationDone, setAnimationDone] = useState(false);

  // Animation values
  const masterFade = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // 3D Gyroscopic rings
  const ring1Rotate = useRef(new Animated.Value(0)).current;
  const ring2Rotate = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0.9)).current;

  // Shockwave rings
  const shockwave1Scale = useRef(new Animated.Value(0.2)).current;
  const shockwave1Opacity = useRef(new Animated.Value(0)).current;
  const shockwave2Scale = useRef(new Animated.Value(0.2)).current;
  const shockwave2Opacity = useRef(new Animated.Value(0)).current;

  // Laser beam sweep
  const laserTranslateX = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;

  // Typography - immediately visible so user sees Course Arena from frame 0
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textTranslateY = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(1)).current;

  // Ambient glow pulse
  const ambientGlowScale = useRef(new Animated.Value(0.8)).current;
  const ambientGlowOpacity = useRef(new Animated.Value(0.4)).current;

  // Floating particles
  const particle1Y = useRef(new Animated.Value(0)).current;
  const particle2Y = useRef(new Animated.Value(0)).current;
  const particle3Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Continuous ring rotations
    Animated.loop(
      Animated.timing(ring1Rotate, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(ring2Rotate, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. Ambient glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ambientGlowScale, {
            toValue: 1.25,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ambientGlowOpacity, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ambientGlowScale, {
            toValue: 0.9,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ambientGlowOpacity, {
            toValue: 0.4,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // 3. Floating cosmic particles
    Animated.loop(
      Animated.sequence([
        Animated.timing(particle1Y, { toValue: -30, duration: 1800, useNativeDriver: true }),
        Animated.timing(particle1Y, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(particle2Y, { toValue: 35, duration: 2200, useNativeDriver: true }),
        Animated.timing(particle2Y, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(particle3Y, { toValue: -25, duration: 1600, useNativeDriver: true }),
        Animated.timing(particle3Y, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();

    // 4. Main entrance sequence (Cinematic Motion Graphics)
    Animated.sequence([
      // Phase A: Logo springs into center with 3D rotation & ambient light
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),

      // Phase B: Shockwave burst & Laser Sweep
      Animated.parallel([
        // Shockwave 1
        Animated.sequence([
          Animated.timing(shockwave1Opacity, { toValue: 0.8, duration: 100, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(shockwave1Scale, { toValue: 3.5, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(shockwave1Opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        // Shockwave 2 (delayed slightly)
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(shockwave2Opacity, { toValue: 0.6, duration: 100, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(shockwave2Scale, { toValue: 3.2, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(shockwave2Opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        // Laser beam crossing logo
        Animated.timing(laserTranslateX, {
          toValue: SCREEN_WIDTH * 0.8,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Typography entrance
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(textTranslateY, { toValue: 0, friction: 6, useNativeDriver: true }),
        ]),
      ]),

      // Phase C: Tagline fade in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),

      // Hold climax briefly
      Animated.delay(400),

      // Phase D: Smooth cinematic dissolve into app
      Animated.timing(masterFade, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnimationDone(true);
    });

    // Hard fail-safe: guaranteed exit so app never blocks
    const safetyTimer = setTimeout(() => {
      setAnimationDone(true);
    }, durationMs + 600);

    return () => clearTimeout(safetyTimer);
  }, [
    durationMs,
    masterFade,
    logoScale,
    logoOpacity,
    logoRotate,
    ring1Rotate,
    ring2Rotate,
    ambientGlowScale,
    ambientGlowOpacity,
    shockwave1Scale,
    shockwave1Opacity,
    shockwave2Scale,
    shockwave2Opacity,
    laserTranslateX,
    textOpacity,
    textTranslateY,
    taglineOpacity,
    particle1Y,
    particle2Y,
    particle3Y,
  ]);

  const spinRing1 = ring1Rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const spinRing2 = ring2Rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const logoSpin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-18deg", "0deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={!isAnimationDone}
        barStyle="light-content"
        backgroundColor="#080B14"
        translucent
      />
      {children}

      {!isAnimationDone && (
        <Animated.View
          style={[
            styles.splashContainer,
            { opacity: masterFade },
          ]}
          pointerEvents="none"
        >
          {/* Ambient Cosmic Radial Aura */}
          <Animated.View
            style={[
              styles.ambientGlow,
              {
                transform: [{ scale: ambientGlowScale }],
                opacity: ambientGlowOpacity,
              },
            ]}
          />

          {/* Floating cosmic light particles */}
          <Animated.View
            style={[
              styles.particle,
              {
                top: "22%",
                left: "18%",
                width: 6,
                height: 6,
                backgroundColor: "#38BDF8",
                transform: [{ translateY: particle1Y }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                top: "30%",
                right: "20%",
                width: 8,
                height: 8,
                backgroundColor: "#818CF8",
                transform: [{ translateY: particle2Y }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                bottom: "28%",
                left: "24%",
                width: 5,
                height: 5,
                backgroundColor: "#F59E0B",
                transform: [{ translateY: particle3Y }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              {
                bottom: "22%",
                right: "22%",
                width: 7,
                height: 7,
                backgroundColor: "#06B6D4",
                transform: [{ translateY: particle1Y }],
              },
            ]}
          />

          {/* Shockwave Rings */}
          <Animated.View
            style={[
              styles.shockwave,
              {
                borderColor: "#38BDF8",
                transform: [{ scale: shockwave1Scale }],
                opacity: shockwave1Opacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.shockwave,
              {
                borderColor: "#818CF8",
                transform: [{ scale: shockwave2Scale }],
                opacity: shockwave2Opacity,
              },
            ]}
          />

          {/* Rotating 3D Gyroscopic Laser Rings */}
          <View style={styles.gyroWrapper}>
            {/* Outer Cyan Ring */}
            <Animated.View
              style={[
                styles.gyroRing,
                styles.ring1,
                { transform: [{ rotate: spinRing1 }] },
              ]}
            />
            {/* Middle Violet Ring */}
            <Animated.View
              style={[
                styles.gyroRing,
                styles.ring2,
                { transform: [{ rotate: spinRing2 }] },
              ]}
            />
            {/* Inner Amber Orbit Ring */}
            <View style={[styles.gyroRing, styles.ring3]} />

            {/* Main 3D Logo Emblem */}
            <Animated.View
              style={[
                styles.logoWrapper,
                {
                  opacity: logoOpacity,
                  transform: [
                    { scale: logoScale },
                    { rotate: logoSpin },
                  ],
                },
              ]}
            >
              <Animated.Image
                source={require("../../assets/images/logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />

              {/* Laser Beam Highlight Sweep */}
              <View style={styles.laserContainer}>
                <Animated.View
                  style={[
                    styles.laserBeam,
                    { transform: [{ translateX: laserTranslateX }] },
                  ]}
                />
              </View>
            </Animated.View>
          </View>

          {/* Animated Typography */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <Text style={styles.titleText}>COURSE ARENA</Text>

            <Animated.View style={{ opacity: taglineOpacity, marginTop: 8 }}>
              <Text style={styles.taglineText}>
                LEARN <Text style={{ color: "#38BDF8" }}>•</Text> GROW{" "}
                <Text style={{ color: "#38BDF8" }}>•</Text> ACHIEVE
              </Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080B14",
  },
  splashContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#080B14",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999999,
  },
  ambientGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(79, 70, 229, 0.25)",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 20,
  },
  particle: {
    position: "absolute",
    borderRadius: 8,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 5,
  },
  shockwave: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2.5,
  },
  gyroWrapper: {
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gyroRing: {
    position: "absolute",
    borderRadius: 999,
  },
  ring1: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.5)",
    borderStyle: "dashed",
    shadowColor: "#38BDF8",
    shadowOpacity: 0.7,
    shadowRadius: 15,
  },
  ring2: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderTopColor: "#818CF8",
    borderBottomColor: "#C084FC",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    shadowColor: "#818CF8",
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  ring3: {
    width: 170,
    height: 170,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.4)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  logoWrapper: {
    width: 170,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  logoImage: {
    width: 160,
    height: 160,
  },
  laserContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: 80,
  },
  laserBeam: {
    width: 60,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    transform: [{ skewX: "-25deg" }],
    shadowColor: "#FFFFFF",
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  textContainer: {
    alignItems: "center",
    marginTop: 26,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 6,
    textTransform: "uppercase",
    textShadowColor: "rgba(99, 102, 241, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  taglineText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
});
