import { StyleSheet, Text, View, Pressable } from "react-native";
import { Link } from "expo-router";
import {
  getBuiltinProfile,
  resolveInningsConfig,
} from "@howzzat/rules-engine";

export default function HomeScreen() {
  const profile = getBuiltinProfile("u9-softball-london-v1");
  const config = profile ? resolveInningsConfig(profile, 8) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Howzzat Scorer</Text>
      <Text style={styles.subtitle}>Ball-by-ball scoring for junior cricket</Text>

      {profile && config && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{profile.name}</Text>
          <Text style={styles.cardBody}>
            {config.playersPerSide} players · {config.totalOvers} overs · base{" "}
            {profile.startingScore}
          </Text>
        </View>
      )}

      <Link href="/score" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Start scoring (demo)</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#eef2f7",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B4169",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B4169" },
  cardBody: { fontSize: 14, color: "#666", marginTop: 4 },
  button: {
    backgroundColor: "#54ACEE",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
