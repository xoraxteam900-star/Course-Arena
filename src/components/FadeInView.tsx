import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

export function FadeInView({ children, style }: { children: React.ReactNode, style?: any }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (Platform.OS === 'android') return;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  if (Platform.OS === 'android') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  return (
    <Animated.View style={[{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }, style]}>
      {children}
    </Animated.View>
  );
}
