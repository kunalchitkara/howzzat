import { Stack } from "expo-router";

export default function MatchLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0B4169" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Match" }} />
      <Stack.Screen name="squads" options={{ title: "Squads" }} />
      <Stack.Screen name="toss" options={{ title: "Toss" }} />
      <Stack.Screen name="score" options={{ title: "Scorer" }} />
      <Stack.Screen name="result" options={{ title: "Result" }} />
      <Stack.Screen name="dashboard" options={{ title: "Dashboard" }} />
    </Stack>
  );
}
