import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Animated, NativeSyntheticEvent, NativeScrollEvent } from "react-native";

interface NavBarVisibilityContextType {
  isNavBarVisible: boolean;
  animValue: Animated.Value;
  showNavBar: () => void;
  hideNavBar: () => void;
  toggleNavBar: () => void;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const NavBarVisibilityContext = createContext<NavBarVisibilityContextType>({
  isNavBarVisible: true,
  animValue: new Animated.Value(1),
  showNavBar: () => {},
  hideNavBar: () => {},
  toggleNavBar: () => {},
  handleScroll: () => {},
});

export function NavBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isNavBarVisible, setIsNavBarVisible] = useState(true);
  const animValue = useRef(new Animated.Value(1)).current; // 1 = visible, 0 = hidden
  const lastScrollY = useRef(0);
  const scrollThreshold = 18;

  const showNavBar = useCallback(() => {
    setIsNavBarVisible(true);
    Animated.spring(animValue, {
      toValue: 1,
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [animValue]);

  const hideNavBar = useCallback(() => {
    setIsNavBarVisible(false);
    Animated.spring(animValue, {
      toValue: 0,
      friction: 9,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [animValue]);

  const toggleNavBar = useCallback(() => {
    if (isNavBarVisible) {
      hideNavBar();
    } else {
      showNavBar();
    }
  }, [isNavBarVisible, hideNavBar, showNavBar]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      // Always show when close to top
      if (currentY <= 30) {
        if (!isNavBarVisible) showNavBar();
        lastScrollY.current = currentY;
        return;
      }

      // Hide when scrolling down past threshold
      if (diff > scrollThreshold && isNavBarVisible) {
        hideNavBar();
      }
      // Show when scrolling up past threshold
      else if (diff < -scrollThreshold && !isNavBarVisible) {
        showNavBar();
      }

      lastScrollY.current = currentY;
    },
    [isNavBarVisible, hideNavBar, showNavBar]
  );

  return (
    <NavBarVisibilityContext.Provider
      value={{
        isNavBarVisible,
        animValue,
        showNavBar,
        hideNavBar,
        toggleNavBar,
        handleScroll,
      }}
    >
      {children}
    </NavBarVisibilityContext.Provider>
  );
}

export function useNavBarVisibility() {
  return useContext(NavBarVisibilityContext);
}
