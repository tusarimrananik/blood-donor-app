import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { API_BASE } from "@/constants/api";

type ApiDonor = {
  id: string;
  name: string;
  phone: string;
  email: string;
  bloodGroup: string;
  area: string;
  lastDonated: string; // ISO
  lat: number;
  lon: number;
  createdAt: string;
  updatedAt: string;
};

function normalizeLastDonated(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(d1: Date, d2: Date) {
  const ms = d2.getTime() - d1.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function safeParseDateYYYYMMDD(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export default function DonorDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string;
    distance?: string;
    eligible?: string;
    daysLeft?: string;
    nextEligibleDate?: string;
  }>();

  const idStr = useMemo(() => {
    const v: any = params.id;
    if (!v) return "";
    return Array.isArray(v) ? String(v[0] ?? "") : String(v);
  }, [params.id]);

  const distanceText = useMemo(() => {
    const v: any = params.distance;
    const s = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
    if (!s) return "Unknown";
    const n = Number(s);
    return Number.isFinite(n) ? `${n.toFixed(2)} km` : "Unknown";
  }, [params.distance]);

  const [donor, setDonor] = useState<ApiDonor | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!idStr) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setErrMsg("");

      try {
        const res = await fetch(`${API_BASE}/donors/${encodeURIComponent(idStr)}`);
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error((json && (json.message || json.error)) || `HTTP ${res.status}`);
        }
        if (!json?.ok || !json?.donor) throw new Error("Invalid response");

        if (alive) setDonor(json.donor as ApiDonor);
      } catch (e: any) {
        if (alive) {
          setDonor(null);
          setErrMsg(e?.message || "Failed to load donor");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [idStr]);

  const eligibility = useMemo(() => {
    if (!donor) {
      const eligibleBool = params.eligible === "true";
      const dl = Number(params.daysLeft || "0");
      const nd = params.nextEligibleDate || "Unknown";
      return eligibleBool
        ? { text: "✅ Eligible", eligible: true }
        : { text: `⏳ Eligible in ${dl} days (${nd})`, eligible: false };
    }

    const lastStr = normalizeLastDonated(donor.lastDonated);
    const last = safeParseDateYYYYMMDD(lastStr);
    if (!last) return { text: "⏳ Not eligible (invalid last donation date)", eligible: false };

    const today = new Date();
    const passed = daysBetween(last, today);
    const eligible = passed >= 90;

    if (eligible) return { text: "✅ Eligible", eligible: true };

    const daysLeft = 90 - passed;
    const next = new Date(last.getTime());
    next.setDate(next.getDate() + 90);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");
    const nextEligibleDate = `${yyyy}-${mm}-${dd}`;

    return { text: `⏳ Eligible in ${daysLeft} days (${nextEligibleDate})`, eligible: false };
  }, [donor, params.eligible, params.daysLeft, params.nextEligibleDate]);

  const lastDonationText = useMemo(() => {
    if (!donor) return "—";
    return donor.lastDonated ? normalizeLastDonated(donor.lastDonated) : "Not provided";
  }, [donor]);

  const openUrlOrAlert = async (url: string, failTitle: string, failMsg: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(failTitle, failMsg);
      return;
    }
    Linking.openURL(url);
  };

  const handleDirections = async () => {
    if (!donor) return;
    const destination = `${donor.lat},${donor.lon}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    await openUrlOrAlert(url, "Cannot open Maps", "Could not open Google Maps.");
  };

  const handleCall = async () => {
    if (!donor) return;
    await openUrlOrAlert(`tel:${donor.phone}`, "Cannot call", "Your device/browser cannot place calls here.");
  };

  const handleSms = async () => {
    if (!donor) return;
    await openUrlOrAlert(`sms:${donor.phone}`, "Cannot SMS", "Your device/browser cannot send SMS here.");
  };

  const handleEmail = async () => {
    if (!donor) return;
    await openUrlOrAlert(`mailto:${donor.email}`, "Cannot email", "Your device/browser cannot open email here.");
  };

  const handleCopyPhone = async () => {
    if (!donor) return;

    if (Platform.OS === "web") {
      const navAny: any = globalThis as any;
      const clip = navAny?.navigator?.clipboard;
      if (clip?.writeText) {
        await clip.writeText(donor.phone);
        Alert.alert("Copied ✅", "Phone number copied to clipboard.");
        return;
      }
    }

    Alert.alert("Copy phone", donor.phone);
  };

  const handleRequest = () => {
    if (!donor) return;
    Alert.alert(
      "Request Sent (Demo)",
      `Request sent to ${donor.name} (${donor.bloodGroup}).\n\nNext step later: store requests in backend.`
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: "Donor Details", headerBackTitle: "Back" }} />

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading…</Text>
            <Text style={styles.text}>Fetching donor details from backend.</Text>
          </View>
        ) : errMsg ? (
          <View style={styles.card}>
            <Text style={styles.title}>Failed to load donor</Text>
            <Text style={styles.text}>{errMsg}</Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : !donor ? (
          <View style={styles.card}>
            <Text style={styles.title}>Donor not found</Text>
            <Text style={styles.text}>No donor exists for id: {idStr}</Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.name}>{donor.name}</Text>

              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>🩸 {donor.bloodGroup}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>📍 {donor.area}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>📏 {distanceText}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <InfoRow label="Eligible" value={eligibility.text} />
              <InfoRow label="Last donation" value={lastDonationText} />
              <InfoRow label="Phone" value={donor.phone} />
              <InfoRow label="Email" value={donor.email} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRequest}>
                <Text style={styles.primaryBtnText}>Request (Demo)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleSms}>
                <Text style={styles.secondaryBtnText}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleEmail}>
                <Text style={styles.secondaryBtnText}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyPhone}>
                <Text style={styles.secondaryBtnText}>Copy Phone</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleDirections}>
                <Text style={styles.secondaryBtnText}>Directions (Google Maps)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  name: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  text: { fontSize: 14, opacity: 0.8, marginBottom: 12 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f5f5f5" },
  badgeText: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 10 },
  rowLabel: { fontSize: 14, opacity: 0.7 },
  rowValue: { fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  actions: { gap: 10 },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#111827" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  callBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#16a34a" },
  callBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#f3f4f6" },
  secondaryBtnText: { color: "#111827", fontWeight: "700" },
});
