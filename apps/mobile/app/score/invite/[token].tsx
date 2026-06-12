import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  acceptScorerInvite,
  fetchScorerInvite,
  type ScorerInvitePreview,
} from "../../../lib/api";
import { fetchCurrentUser, useGoogleSignIn } from "../../../lib/auth";

export default function ScorerInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const inviteToken = token!;
  const router = useRouter();
  const google = useGoogleSignIn();

  const [invite, setInvite] = useState<ScorerInvitePreview | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvite = useCallback(async () => {
    const data = await fetchScorerInvite(inviteToken);
    setInvite(data);
    return data;
  }, [inviteToken]);

  useEffect(() => {
    void loadInvite().catch((e) =>
      setError(e instanceof Error ? e.message : "Invite not found"),
    );
  }, [loadInvite]);

  useEffect(() => {
    void fetchCurrentUser().then((u) => setSignedIn(Boolean(u)));
  }, [google.busy]);

  async function onAccept() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptScorerInvite(inviteToken);
      router.replace(`/match/${result.matchId}/score`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }

  if (!invite) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  if (invite.expired) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Invite expired</Text>
        <Text style={styles.body}>Ask the match manager for a new scorer link.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Score this match</Text>
      <Text style={styles.matchTitle}>{invite.matchTitle}</Text>
      {invite.email && (
        <Text style={styles.body}>Invited: {invite.email}</Text>
      )}
      {invite.acceptedAt && (
        <Text style={styles.accepted}>Already accepted — open the scorer below.</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {google.error && <Text style={styles.error}>{google.error}</Text>}

      {!signedIn ? (
        <Pressable
          style={[styles.btn, (!google.ready || google.busy) && styles.btnDisabled]}
          onPress={() => void google.signIn()}
          disabled={!google.ready || google.busy}
        >
          {google.busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign in with Google</Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={onAccept}
          disabled={busy}
        >
          <Text style={styles.btnText}>
            {busy ? "Accepting…" : invite.acceptedAt ? "Open scorer" : "Accept & score"}
          </Text>
        </Pressable>
      )}

      {signedIn && invite.acceptedAt && (
        <Pressable
          style={styles.secondary}
          onPress={() => router.replace(`/match/${invite.matchId}/score`)}
        >
          <Text style={styles.secondaryText}>Skip to match scorer</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f7fb", padding: 24, paddingTop: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  heading: { fontSize: 24, fontWeight: "800", color: "#0B4169", marginBottom: 8 },
  matchTitle: { fontSize: 18, fontWeight: "700", color: "#334155", marginBottom: 12 },
  body: { fontSize: 15, color: "#64748b", marginBottom: 8 },
  accepted: { fontSize: 14, color: "#2d6a3e", marginBottom: 16 },
  btn: {
    backgroundColor: "#0B4169",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondary: { marginTop: 16, alignItems: "center" },
  secondaryText: { color: "#0B4169", fontWeight: "600" },
  error: { color: "#b91c1c", marginTop: 12, textAlign: "center" },
});
