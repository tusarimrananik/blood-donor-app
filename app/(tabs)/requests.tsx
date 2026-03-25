import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { API_BASE } from "@/constants/api";
import { useAuth } from "@/app/lib/auth";
import { Colors } from "@/constants/theme";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const URGENCY_LEVELS = ["STANDARD", "PRIORITY", "URGENT"] as const;

type RequestItem = {
  id: string;
  requesterName: string;
  requesterPhone: string;
  bloodGroup: string;
  message: string | null;
  area: string | null;
  hospital: string | null;
  urgency: string;
  status: string;
  donorId: string | null;
  createdById: string | null;
  createdAt: string;
  assignedDonorName: string | null;
  assignedDonorArea: string | null;
  assignedDonorPhone: string | null;
  createdByName: string | null;
  createdByImage: string | null;
  responseCount: number;
  volunteeredByMe: boolean;
};

type RequestsResponse = {
  ok: boolean;
  total: number;
  items: RequestItem[];
  message?: string;
};

function formatRelativeTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function requestTone(urgency: string, status: string) {
  if (status === "ASSIGNED") {
    return { label: "Assigned", color: Colors.light.info, backgroundColor: "#dbeafe" };
  }

  if (status === "COMPLETED") {
    return { label: "Completed", color: Colors.light.success, backgroundColor: "#d1fae5" };
  }

  if (urgency === "URGENT") {
    return { label: "Urgent", color: Colors.light.danger, backgroundColor: "#fee2e2" };
  }

  if (urgency === "PRIORITY") {
    return { label: "Priority", color: Colors.light.warning, backgroundColor: "#fef3c7" };
  }

  return { label: "Open", color: Colors.light.success, backgroundColor: "#d1fae5" };
}

export default function RequestsScreen() {
  const { authFetch, user } = useAuth();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [bloodGroup, setBloodGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [urgency, setUrgency] = useState<(typeof URGENCY_LEVELS)[number]>("STANDARD");
  const [area, setArea] = useState("");
  const [hospital, setHospital] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setBloodGroup(user.bloodGroup as (typeof BLOOD_GROUPS)[number]);
    setArea(user.area);
  }, [user]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await authFetch(`${API_BASE}/requests?limit=50&offset=0`);
      const json = (await res.json().catch(() => null)) as RequestsResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      setRequests(
        (json.items ?? []).map((item) => ({
          ...item,
          responseCount: Number(item.responseCount ?? 0),
        })),
      );
      setTotal(json.total ?? 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load requests");
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const urgentCount = useMemo(
    () => requests.filter((item) => requestTone(item.urgency, item.status).label === "Urgent").length,
    [requests],
  );

  const createRequest = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await authFetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloodGroup,
          urgency,
          area: area.trim(),
          hospital: hospital.trim(),
          message: message.trim(),
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
          if (lines.length) throw new Error(lines.join("\n"));
        }
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      setHospital("");
      setMessage("");
      setUrgency("STANDARD");
      await loadRequests();
      Alert.alert("Request posted", "Your blood request is now visible to all users.");
    } catch (e: any) {
      Alert.alert("Could not create request", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const volunteerForRequest = async (requestId: string) => {
    if (respondingId) return;
    setRespondingId(requestId);

    try {
      const res = await authFetch(`${API_BASE}/requests/${encodeURIComponent(requestId)}/respond`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      await loadRequests();
      Alert.alert("You're in", "The requester can now see that you volunteered to donate.");
    } catch (e: any) {
      Alert.alert("Could not volunteer", e?.message || "Something went wrong.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRequests} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroPill}>
          <Ionicons name="megaphone-outline" size={16} color="#fff" />
          <Text style={styles.heroPillText}>Live request board</Text>
        </View>
        <Text style={styles.title}>Community Requests</Text>
        <Text style={styles.subtitle}>Create blood requests and volunteer directly when you see a request you can help with.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Visible requests</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{urgentCount}</Text>
            <Text style={styles.statLabel}>Urgent right now</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create New Request</Text>
        <Text style={styles.helper}>Your name and phone are taken automatically from your account.</Text>

        <Text style={styles.label}>Blood Group Needed</Text>
        <View style={styles.chipsRow}>
          {BLOOD_GROUPS.map((item) => {
            const active = bloodGroup === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setBloodGroup(item)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Urgency</Text>
        <View style={styles.chipsRow}>
          {URGENCY_LEVELS.map((item) => {
            const active = urgency === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setUrgency(item)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item === "STANDARD" ? "Standard" : item === "PRIORITY" ? "Priority" : "Urgent"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Area</Text>
        <TextInput value={area} onChangeText={setArea} style={styles.input} placeholder="Area for the request" />

        <Text style={styles.label}>Hospital</Text>
        <TextInput value={hospital} onChangeText={setHospital} style={styles.input} placeholder="Hospital name (optional)" />

        <Text style={styles.label}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          style={[styles.input, styles.textArea]}
          placeholder="Explain the urgency and details"
          multiline
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={createRequest}>
          <Text style={styles.primaryBtnText}>{submitting ? "Posting..." : "Post request"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>All Blood Requests</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadRequests}>
            <Text style={styles.refreshBtnText}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>API error: {error}</Text> : null}

        {requests.map((item) => {
          const tone = requestTone(item.urgency, item.status);
          const canVolunteer =
            item.status === "OPEN" &&
            !item.volunteeredByMe &&
            item.createdById !== user?.id &&
            user?.canDonate === true &&
            user?.bloodGroup === item.bloodGroup;

          return (
            <View key={item.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.avatarMini}>
                  {item.createdByImage ? (
                    <Image source={{ uri: item.createdByImage }} style={styles.avatarMiniImage} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarMiniText}>
                      {(item.createdByName || item.requesterName).slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.requestHeaderCopy}>
                  <Text style={styles.requesterName}>{item.requesterName}</Text>
                  <Text style={styles.metaText}>
                    {item.bloodGroup} • {item.requesterPhone}
                  </Text>
                  <Text style={styles.metaText}>
                    {item.area || "Area unknown"} • {item.hospital || "Hospital not listed"}
                  </Text>
                </View>

                <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
                  <Text style={[styles.badgeText, { color: tone.color }]}>{tone.label}</Text>
                </View>
              </View>

              <View style={styles.inlineMetaRow}>
                <View style={styles.inlineMetaTag}>
                  <Ionicons name="pulse-outline" size={14} color={tone.color} />
                  <Text style={[styles.inlineMetaText, { color: tone.color }]}>
                    {item.urgency === "STANDARD"
                      ? "Standard"
                      : item.urgency === "PRIORITY"
                        ? "Priority"
                        : "Urgent"}
                  </Text>
                </View>
                {item.targetDonorId ? (
                  <View style={styles.inlineMetaTag}>
                    <Ionicons name="person-outline" size={14} color={Colors.light.icon} />
                    <Text style={styles.inlineMetaText}>Direct request</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.messageText}>{item.message || "No message provided."}</Text>

              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>Volunteer status</Text>
                <Text style={styles.metaValue}>
                  {item.responseCount} donor{item.responseCount === 1 ? "" : "s"} responded
                </Text>
                <Text style={styles.metaHint}>
                  {item.status === "ASSIGNED"
                    ? `Assigned donor: ${item.assignedDonorName || "Assigned"}`
                    : item.volunteeredByMe
                    ? "You already volunteered for this request."
                    : "No donor assigned yet."}
                </Text>
              </View>

              {canVolunteer ? (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => volunteerForRequest(item.id)}
                  disabled={respondingId === item.id}
                >
                  <Text style={styles.secondaryBtnText}>
                    {respondingId === item.id ? "Sending..." : "I Can Donate"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {!canVolunteer && item.status === "OPEN" && item.createdById !== user?.id && !item.volunteeredByMe ? (
                <Text style={styles.helper}>
                  {user?.canDonate !== true
                    ? "Turn on donation availability in your profile to volunteer."
                    : user?.bloodGroup !== item.bloodGroup
                    ? "Blood group mismatch for this request."
                    : ""}
                </Text>
              ) : null}

              <Text style={styles.timestampText}>Created {formatRelativeTime(item.createdAt)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: "#f5f7fb",
  },
  hero: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroPillText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#fce7ef",
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 14,
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: "#fbcfe8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  helper: {
    color: "#6b7280",
    lineHeight: 18,
  },
  label: {
    fontWeight: "700",
    color: "#111827",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  chipText: {
    color: "#111827",
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fafafa",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: "#8b1e3f",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  secondaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshBtnText: {
    fontWeight: "700",
    color: "#1f2937",
  },
  requestCard: {
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    backgroundColor: "#fcfcfc",
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  requestHeaderCopy: {
    flex: 1,
  },
  avatarMini: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarMiniImage: {
    width: "100%",
    height: "100%",
  },
  avatarMiniText: {
    fontWeight: "900",
    color: "#374151",
  },
  requesterName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  metaText: {
    marginTop: 4,
    color: "#6b7280",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 12,
  },
  messageText: {
    color: "#111827",
    lineHeight: 20,
  },
  inlineMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineMetaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
  },
  inlineMetaText: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 12,
  },
  metaBlock: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: {
    fontWeight: "700",
    color: "#111827",
  },
  metaHint: {
    color: "#4b5563",
  },
  timestampText: {
    color: "#6b7280",
    fontSize: 12,
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
});
