import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { API_BASE } from "@/constants/api";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/app/lib/auth";

type ActivityResponse = {
  ok: boolean;
  myRequests: Array<{
    id: string;
    bloodGroup: string;
    area: string | null;
    hospital: string | null;
    urgency: string;
    donorId: string | null;
    status: string;
    message: string | null;
    createdAt: string;
    responseCount: number;
    targetDonorName: string | null;
  }>;
  requestsForMe: Array<{
    id: string;
    requesterName: string;
    requesterPhone: string;
    bloodGroup: string;
    area: string | null;
    hospital: string | null;
    urgency: string;
    donorId: string | null;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
  myResponses: Array<{
    id: string;
    requestId: string;
    requesterName: string;
    bloodGroup: string;
    area: string | null;
    hospital: string | null;
    urgency: string;
    donorId: string | null;
    status: string;
    message: string | null;
    createdAt: string;
    volunteeredAt: string;
  }>;
  message?: string;
};

function formatRelativeTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const diffHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function badgeForStatus(status: string, donorId: string | null) {
  if (status === "COMPLETED") return { label: "Completed", bg: "#d1fae5", color: Colors.light.success };
  if (status === "CANCELLED") return { label: "Cancelled", bg: "#fee2e2", color: Colors.light.danger };
  if (status === "ASSIGNED" && donorId) return { label: "Assigned", bg: "#dbeafe", color: Colors.light.info };
  return { label: "Open", bg: "#fef3c7", color: Colors.light.warning };
}

function urgencyLabel(urgency: string) {
  if (urgency === "URGENT") return "Urgent";
  if (urgency === "PRIORITY") return "Priority";
  return "Standard";
}

export default function ActivityScreen() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"mine" | "incoming" | "responses">("mine");
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [data, setData] = useState<ActivityResponse>({
    ok: true,
    myRequests: [],
    requestsForMe: [],
    myResponses: [],
  });

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/requests/activity`);
      const json = (await res.json().catch(() => null)) as ActivityResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      loadActivity();
    }, [loadActivity]),
  );

  const counts = useMemo(
    () => ({
      mine: data.myRequests.length,
      incoming: data.requestsForMe.length,
      responses: data.myResponses.length,
    }),
    [data],
  );

  const performAction = async (key: string, url: string, label: string) => {
    setWorkingKey(key);
    try {
      const res = await authFetch(url, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      await loadActivity();
      Alert.alert("Updated", label);
    } catch (e: any) {
      Alert.alert("Action failed", e?.message || "Something went wrong.");
    } finally {
      setWorkingKey(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadActivity} />}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>
          Track the requests you created, the direct requests sent to you, and the public requests you volunteered for.
        </Text>
      </View>

      <View style={styles.segmented}>
        <TouchableOpacity style={[styles.segment, tab === "mine" && styles.segmentActive]} onPress={() => setTab("mine")}>
          <Text style={[styles.segmentText, tab === "mine" && styles.segmentTextActive]}>My Requests ({counts.mine})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segment, tab === "incoming" && styles.segmentActive]} onPress={() => setTab("incoming")}>
          <Text style={[styles.segmentText, tab === "incoming" && styles.segmentTextActive]}>
            Requests For Me ({counts.incoming})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segment, tab === "responses" && styles.segmentActive]} onPress={() => setTab("responses")}>
          <Text style={[styles.segmentText, tab === "responses" && styles.segmentTextActive]}>
            My Responses ({counts.responses})
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>API error: {error}</Text> : null}

      {tab === "mine" ? (
        <View style={styles.card}>
          {data.myRequests.length === 0 ? <Text style={styles.emptyText}>You haven't created any requests yet.</Text> : null}
          {data.myRequests.map((item) => {
            const badge = badgeForStatus(item.status, item.donorId);
            const canCancel = badge.label === "Open";
            const canComplete = badge.label === "Assigned";
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{item.bloodGroup} request</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {item.area || "Area unknown"} • {item.hospital || "Hospital not listed"}
                </Text>
                {item.targetDonorName ? <Text style={styles.metaText}>Direct request to {item.targetDonorName}</Text> : null}
                <View style={styles.inlineTag}>
                  <Ionicons name="pulse-outline" size={14} color={Colors.light.icon} />
                  <Text style={styles.inlineTagText}>{urgencyLabel(item.urgency)}</Text>
                </View>
                <Text style={styles.messageText}>{item.message || "No message provided."}</Text>
                <Text style={styles.metaStrong}>{item.responseCount} donor response(s)</Text>
                <View style={styles.actionsRow}>
                  {canComplete ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      onPress={() =>
                        performAction(
                          `complete-${item.id}`,
                          `${API_BASE}/requests/${encodeURIComponent(item.id)}/complete`,
                          "Request marked as completed.",
                        )
                      }
                      disabled={workingKey === `complete-${item.id}`}
                    >
                      <Text style={styles.acceptBtnText}>
                        {workingKey === `complete-${item.id}` ? "Saving..." : "Accept"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {canCancel ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.cancelBtn]}
                      onPress={() =>
                        performAction(
                          `cancel-${item.id}`,
                          `${API_BASE}/requests/${encodeURIComponent(item.id)}/cancel`,
                          "Your request has been cancelled.",
                        )
                      }
                      disabled={workingKey === `cancel-${item.id}`}
                    >
                      <Text style={styles.cancelBtnText}>
                        {workingKey === `cancel-${item.id}` ? "Saving..." : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.timestampText}>Created {formatRelativeTime(item.createdAt)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {tab === "incoming" ? (
        <View style={styles.card}>
          {data.requestsForMe.length === 0 ? (
            <Text style={styles.emptyText}>No one has directly requested you yet.</Text>
          ) : null}
          {data.requestsForMe.map((item) => {
            const badge = badgeForStatus(item.status, item.donorId);
            const canRespond = badge.label === "Open";
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{item.requesterName}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {item.bloodGroup} • {item.requesterPhone}
                </Text>
                <Text style={styles.metaText}>
                  {item.area || "Area unknown"} • {item.hospital || "Hospital not listed"}
                </Text>
                <View style={styles.inlineTag}>
                  <Ionicons name="pulse-outline" size={14} color={Colors.light.icon} />
                  <Text style={styles.inlineTagText}>{urgencyLabel(item.urgency)}</Text>
                </View>
                <Text style={styles.messageText}>{item.message || "No message provided."}</Text>
                <View style={styles.actionsRow}>
                  {canRespond ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      onPress={() =>
                        performAction(
                          `accept-${item.id}`,
                          `${API_BASE}/requests/${encodeURIComponent(item.id)}/accept`,
                          "You accepted this direct request.",
                        )
                      }
                      disabled={workingKey === `accept-${item.id}`}
                    >
                      <Text style={styles.acceptBtnText}>
                        {workingKey === `accept-${item.id}` ? "Saving..." : "Accept"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {canRespond ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.cancelBtn]}
                      onPress={() =>
                        performAction(
                          `decline-${item.id}`,
                          `${API_BASE}/requests/${encodeURIComponent(item.id)}/cancel`,
                          "You cancelled this direct request.",
                        )
                      }
                      disabled={workingKey === `decline-${item.id}`}
                    >
                      <Text style={styles.cancelBtnText}>
                        {workingKey === `decline-${item.id}` ? "Saving..." : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.timestampText}>Created {formatRelativeTime(item.createdAt)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {tab === "responses" ? (
        <View style={styles.card}>
          {data.myResponses.length === 0 ? (
            <Text style={styles.emptyText}>You haven't volunteered for any requests yet.</Text>
          ) : null}
          {data.myResponses.map((item) => {
            const badge = badgeForStatus(item.status, item.donorId);
            const canWithdraw = badge.label === "Open";
            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{item.requesterName}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {item.bloodGroup} • {item.area || "Area unknown"}
                </Text>
                <Text style={styles.metaText}>{item.hospital || "Hospital not listed"}</Text>
                <View style={styles.inlineTag}>
                  <Ionicons name="pulse-outline" size={14} color={Colors.light.icon} />
                  <Text style={styles.inlineTagText}>{urgencyLabel(item.urgency)}</Text>
                </View>
                <Text style={styles.messageText}>{item.message || "No message provided."}</Text>
                <View style={styles.actionsRow}>
                  {canWithdraw ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.cancelBtn]}
                      onPress={() =>
                        performAction(
                          `withdraw-${item.requestId}`,
                          `${API_BASE}/requests/${encodeURIComponent(item.requestId)}/withdraw`,
                          "Your response has been cancelled.",
                        )
                      }
                      disabled={workingKey === `withdraw-${item.requestId}`}
                    >
                      <Text style={styles.cancelBtnText}>
                        {workingKey === `withdraw-${item.requestId}` ? "Saving..." : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.timestampText}>You volunteered {formatRelativeTime(item.volunteeredAt)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: "#f5f7fb" },
  hero: { backgroundColor: "#102a43", borderRadius: 20, padding: 18, gap: 8 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#d9e2ec", lineHeight: 20 },
  segmented: { backgroundColor: "#fff", borderRadius: 16, padding: 6, gap: 6, borderWidth: 1, borderColor: "#ececec" },
  segment: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10 },
  segmentActive: { backgroundColor: "#111827" },
  segmentText: { color: "#374151", fontWeight: "700", textAlign: "center" },
  segmentTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: "#ececec" },
  itemCard: { backgroundColor: "#fcfcfc", borderRadius: 14, borderWidth: 1, borderColor: "#ececec", padding: 14, gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  itemTitle: { fontSize: 16, fontWeight: "800", color: "#111827", flex: 1 },
  metaText: { color: "#6b7280" },
  metaStrong: { color: "#111827", fontWeight: "700" },
  messageText: { color: "#111827", lineHeight: 20 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontWeight: "800", fontSize: 12 },
  timestampText: { color: "#6b7280", fontSize: 12 },
  emptyText: { color: "#6b7280", lineHeight: 20 },
  errorText: { color: "#b91c1c", fontWeight: "700" },
  inlineTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  inlineTagText: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    minWidth: 96,
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  acceptBtn: {
    backgroundColor: "#dcfce7",
  },
  cancelBtn: {
    backgroundColor: "#fee2e2",
  },
  acceptBtnText: {
    color: "#166534",
    fontWeight: "800",
  },
  cancelBtnText: {
    color: "#b91c1c",
    fontWeight: "800",
  },
});
