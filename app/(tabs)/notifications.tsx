import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { API_BASE } from "@/constants/api";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  requestId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorImage: string | null;
};

type NotificationsResponse = {
  ok: boolean;
  unreadCount: number;
  items: NotificationItem[];
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

function firstInitial(name: string | null | undefined) {
  return name?.trim().charAt(0).toUpperCase() || "N";
}

export default function NotificationsScreen() {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/notifications`);
      const json = (await res.json().catch(() => null)) as NotificationsResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setItems(json.items ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const unreadItems = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const markAllRead = async () => {
    try {
      const res = await authFetch(`${API_BASE}/notifications/read-all`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      await loadNotifications();
    } catch (e: any) {
      setError(e?.message || "Could not mark notifications as read");
    }
  };

  const markRead = async (id: string) => {
    try {
      const res = await authFetch(`${API_BASE}/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (e: any) {
      setError(e?.message || "Could not update notification");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadNotifications} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="notifications-outline" size={16} color="#fff" />
          <Text style={styles.heroBadgeText}>Updates</Text>
        </View>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Stay on top of new requests, donor responses, and request decisions.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{items.length}</Text>
            <Text style={styles.statLabel}>Recent events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Unread now</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Inbox</Text>
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} disabled={unreadItems === 0}>
            <Text style={styles.markAllText}>{unreadItems === 0 ? "All read" : "Mark all read"}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>API error: {error}</Text> : null}
        {!items.length ? <Text style={styles.emptyText}>No notifications yet. New request activity will show up here.</Text> : null}

        {items.map((item) => {
          const unread = !item.readAt;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.notificationCard, unread && styles.notificationCardUnread]}
              onPress={() => {
                if (unread) {
                  void markRead(item.id);
                }
              }}
              activeOpacity={0.9}
            >
              <View style={styles.avatarWrap}>
                {item.actorImage ? (
                  <Image source={{ uri: item.actorImage }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{firstInitial(item.actorName)}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.notificationBody}>{item.body}</Text>
                <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
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
    backgroundColor: Colors.light.background,
  },
  hero: {
    backgroundColor: "#102a43",
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroBadgeText: {
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
    color: "#d9e2ec",
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
    color: "#d9e2ec",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.light.text,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fceef3",
  },
  markAllText: {
    color: Colors.light.tint,
    fontWeight: "800",
  },
  notificationCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fcfcfc",
  },
  notificationCardUnread: {
    borderColor: "#f2b7c7",
    backgroundColor: "#fff8fa",
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#374151",
    fontWeight: "900",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.light.tint,
  },
  notificationTitle: {
    color: Colors.light.text,
    fontWeight: "800",
    flex: 1,
  },
  notificationBody: {
    color: "#4b5563",
    lineHeight: 20,
  },
  timeText: {
    color: Colors.light.icon,
    fontSize: 12,
  },
  emptyText: {
    color: Colors.light.icon,
    lineHeight: 20,
  },
  errorText: {
    color: Colors.light.danger,
    fontWeight: "700",
  },
});
