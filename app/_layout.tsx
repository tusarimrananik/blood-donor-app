import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Colors } from "@/constants/theme";

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthRedirector() {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!ready || !navigationState?.key) return;

    const inAuthScreen = segments[0] === "auth";

    if (!isAuthenticated && !inAuthScreen) {
      router.replace("/auth");
      return;
    }

    if (isAuthenticated && inAuthScreen) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, navigationState?.key, ready, router, segments]);

  return null;
}

function SystemBars() {
  useEffect(() => {
    NavigationBar.setButtonStyleAsync("dark").catch(() => {});
  }, []);

  return null;
}

export default function RootLayout() {
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.light.background,
      card: Colors.light.card,
      border: Colors.light.border,
      text: Colors.light.text,
      primary: Colors.light.tint,
    },
  };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
        <AuthProvider>
          <ThemeProvider value={theme}>
            <SystemBars />
            <AuthRedirector />
            <Stack>
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="dark" backgroundColor={Colors.light.card} />
          </ThemeProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
