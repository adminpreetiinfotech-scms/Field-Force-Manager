import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from "@expo-google-fonts/noto-sans-devanagari";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/contexts/AppContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

SplashScreen.preventAutoHideAsync();

// On web (and Expo web preview) the iframe is served from the same origin as
// the API proxy, so `/api/...` resolves correctly with no base URL. For native
// builds we point the generated client at the published Expo domain so the
// device hits the correct API host.
if (Platform.OS !== "web") {
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
  const normalized = domain.startsWith("http") ? domain : `https://${domain}`;
  setBaseUrl(normalized);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2_000,
      refetchOnWindowFocus: true,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(staff)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(super-admin)" options={{ headerShown: false }} />
      <Stack.Screen
        name="attendance/check-in"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="route/[staffId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="activity/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="candidate"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="account-settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="alert-preferences"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AppProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="dark" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AppProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
