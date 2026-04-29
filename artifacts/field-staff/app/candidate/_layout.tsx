import { Stack } from "expo-router";
import React from "react";

export default function CandidateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="register" />
      <Stack.Screen name="list" />
      <Stack.Screen name="my-candidates" />
      <Stack.Screen name="drafts" />
    </Stack>
  );
}
