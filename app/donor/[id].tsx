import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE } from "@/constants/api";
import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/theme";

type ApiDonor = {
  id: string;
  name: string;
  phone: string;
  email: string;
  profileImage: string | null;
  bloodGroup: string;
  area: string;
  lastDonated: string | null;
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

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const URGENCY_LEVELS = ["STANDARD", "PRIORITY", "URGENT"] as const;
const PLACEHOLDER_TEXT_COLOR = "#8b95a7";

function firstInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "D";
}

export default function DonorDetailsScreen() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const insets = useSafeAreaInsets();

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
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestGroup, setRequestGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [requestUrgency, setRequestUrgency] = useState<(typeof URGENCY_LEVELS)[number]>("STANDARD");
  const [requestArea, setRequestArea] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    if (!idStr) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setErrMsg("");

      try {
        const res = await fetch(`${API_BASE}/donors/${encodeURIComponent(idStr)}`);
        const json = await res.json().catch(() => null);

        if (!res.ok) throw new Error((json && (json.message || json.error)) || `HTTP ${res.status}`);
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

  useEffect(() => {
    if (!user) return;
    setRequestGroup(user.bloodGroup as (typeof BLOOD_GROUPS)[number]);
    setRequestArea(user.area);
  }, [user]);

  const eligibility = useMemo(() => {
    if (!donor) {
      const eligibleBool = params.eligible === "true";
      const dl = Number(params.daysLeft || "0");
      const nd = params.nextEligibleDate || "Unknown";
      return eligibleBool
        ? { text: "Eligible", eligible: true }
        : { text: `Eligible in ${dl} days (${nd})`, eligible: false };
    }

    if (!donor.lastDonated) return { text: "Eligible now (first-time donor)", eligible: true };

    const lastStr = normalizeLastDonated(donor.lastDonated);
    const last = safeParseDateYYYYMMDD(lastStr);
    if (!last) return { text: "Not eligible (invalid last donation date)", eligible: false };

    const today = new Date();
    const passed = daysBetween(last, today);
    if (passed >= 90) return { text: "Eligible", eligible: true };

    const daysLeft = 90 - passed;
    const next = new Date(last.getTime());
    next.setDate(next.getDate() + 90);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    const dd = String(next.getDate()).padStart(2, "0");

    return { text: `Eligible in ${daysLeft} days (${yyyy}-${mm}-${dd})`, eligible: false };
  }, [donor, params.daysLeft, params.eligible, params.nextEligibleDate]);

  const lastDonationText = useMemo(() => {
    if (!donor) return "-";
    return donor.lastDonated ? normalizeLastDonated(donor.lastDonated) : "First-time donor";
  }, [donor]);

  const openUrlOrAlert = async (url: string, failTitle: string, failMsg: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(failTitle, failMsg);
    }
  };

  const submitDirectRequest = async () => {
    if (!donor || submittingRequest) return;
    setSubmittingRequest(true);

    try {
      const res = await authFetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloodGroup: requestGroup,
          urgency: requestUrgency,
          area: requestArea.trim(),
          message: requestMessage.trim(),
          targetDonorId: donor.id,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const fieldErrors = json?.errors?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === "object") {
          const lines: string[] = [];
          for (const key of Object.keys(fieldErrors)) {
            const value = fieldErrors[key];
            if (Array.isArray(value) && value.length) {
              lines.push(`${key}: ${value.join(", ")}`);
            }
          }
          if (lines.length) {
            throw new Error(lines.join("\n"));
          }
        }
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      setShowRequestForm(false);
      setRequestMessage("");
      setRequestUrgency("STANDARD");
      Alert.alert("Request sent", `Your direct request has been sent to ${donor.name}.`);
    } catch (e: any) {
      Alert.alert("Could not send request", e?.message || "Something went wrong.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Donor Details", headerBackTitle: "Back" }} />
      <StatusBar style="dark" backgroundColor={Colors.light.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 24 + Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.title}>Loading...</Text>
            <Text style={styles.text}>Fetching donor details.</Text>
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
              <View style={styles.profileHeader}>
                <View style={styles.avatarWrap}>
                  {donor.profileImage ? (
                    <Image source={{ uri: donor.profileImage }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarFallback}>{firstInitial(donor.name)}</Text>
                  )}
                </View>

                <View style={styles.profileCopy}>
                  <Text style={styles.name}>{donor.name}</Text>
                  <Text style={styles.subtleLine}>Ready to contact directly from the app</Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons name="water-outline" size={13} color={Colors.light.tint} />
                  <Text style={styles.badgeText}>{donor.bloodGroup}</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="location-outline" size={13} color={Colors.light.tint} />
                  <Text style={styles.badgeText}>{donor.area}</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="navigate-outline" size={13} color={Colors.light.tint} />
                  <Text style={styles.badgeText}>{distanceText}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <InfoRow label="Eligible" value={eligibility.text} />
              <InfoRow label="Last donation" value={lastDonationText} />
              <InfoRow label="Phone" value={donor.phone} />
              <InfoRow label="Email" value={donor.email} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowRequestForm((value) => !value)}>
                <Text style={styles.primaryBtnText}>{showRequestForm ? "Close Request Form" : "Request This Donor"}</Text>
              </TouchableOpacity>

              {showRequestForm ? (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Direct Request</Text>
                  <Text style={styles.formHint}>This request will appear in your activity and in this donor&apos;s incoming requests.</Text>

                  <Text style={styles.label}>Blood Group Needed</Text>
                  <View style={styles.chipsRow}>
                    {BLOOD_GROUPS.map((group) => {
                      const active = requestGroup === group;
                      return (
                        <TouchableOpacity
                          key={group}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setRequestGroup(group)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{group}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Urgency</Text>
                  <View style={styles.chipsRow}>
                    {URGENCY_LEVELS.map((level) => {
                      const active = requestUrgency === level;
                      return (
                        <TouchableOpacity
                          key={level}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setRequestUrgency(level)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {level === "STANDARD" ? "Standard" : level === "PRIORITY" ? "Priority" : "Urgent"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Area</Text>
                  <TextInput
                    value={requestArea}
                    onChangeText={setRequestArea}
                    style={styles.input}
                    placeholder="Request area"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                  />

                  <Text style={styles.label}>Message</Text>
                  <TextInput
                    value={requestMessage}
                    onChangeText={setRequestMessage}
                    style={[styles.input, styles.textArea]}
                    placeholder="Explain why you need blood"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    multiline
                  />

                  <TouchableOpacity style={styles.callBtn} onPress={submitDirectRequest}>
                    <Text style={styles.callBtnText}>{submittingRequest ? "Sending..." : "Send Direct Request"}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity style={styles.callBtn} onPress={() => openUrlOrAlert(`tel:${donor.phone}`, "Cannot call", "Your device/browser cannot place calls here.")}>
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openUrlOrAlert(`sms:${donor.phone}`, "Cannot SMS", "Your device/browser cannot send SMS here.")}>
                <Text style={styles.secondaryBtnText}>SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openUrlOrAlert(`mailto:${donor.email}`, "Cannot email", "Your device/browser cannot open email here.")}>
                <Text style={styles.secondaryBtnText}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={async () => {
                if (Platform.OS === "web") {
                  const navAny: any = globalThis as any;
                  const clip = navAny?.navigator?.clipboard;
                  if (clip?.writeText) {
                    await clip.writeText(donor.phone);
                    Alert.alert("Copied", "Phone number copied to clipboard.");
                    return;
                  }
                }
                Alert.alert("Copy phone", donor.phone);
              }}>
                <Text style={styles.secondaryBtnText}>Copy Phone</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => openUrlOrAlert(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${donor.lat},${donor.lon}`)}`, "Cannot open Maps", "Could not open Google Maps.")}>
                <Text style={styles.secondaryBtnText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  safeArea: { flex: 1, backgroundColor: "#f5f7fb" },
  scrollView: { flex: 1, backgroundColor: "#f5f7fb" },
  container: { padding: 16, gap: 12, backgroundColor: "#f5f7fb", flexGrow: 1 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#eee" },
  formCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#eee", gap: 10 },
  formTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  formHint: { color: "#6b7280", lineHeight: 18 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  profileCopy: { flex: 1, gap: 4 },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { fontSize: 28, fontWeight: "900", color: "#374151", textAlign: "center" },
  name: { fontSize: 22, fontWeight: "700" },
  subtleLine: { color: "#6b7280" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  text: { fontSize: 14, opacity: 0.8, marginBottom: 12 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#fceef3",
  },
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
  label: { fontWeight: "700", color: "#111827" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db" },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#111827", fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: "#fafafa" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
});
