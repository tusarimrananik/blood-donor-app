import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE } from "@/constants/api";
import { Colors } from "@/constants/theme";

type Donor = {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  area: string;
  profileImage: string | null;
  lat: number;
  lon: number;
  availableNow?: boolean;
  lastDonated: string | null;
};

type ApiGetDonorsResponse = {
  ok: boolean;
  total: number;
  items: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    profileImage: string | null;
    bloodGroup: string;
    area: string;
    lastDonated: string;
    lat: number;
    lon: number;
  }[];
  limit?: number;
  offset?: number;
  bloodGroup?: string;
  eligibleOnly?: boolean;
};

const BLOOD_GROUPS = ["All", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const PLACEHOLDER_TEXT_COLOR = "#8b95a7";

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
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

function normalizeLastDonated(input: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return input;

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "D";
}

function distanceLabel(distance: number | null) {
  return distance == null ? "GPS off" : `${distance.toFixed(1)} km away`;
}

export default function FindDonorsScreen() {
  const router = useRouter();
  const fetchSeqRef = useRef(0);

  const [permissionStatus, setPermissionStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLon, setMyLon] = useState<number | null>(null);
  const [apiDonors, setApiDonors] = useState<Donor[]>([]);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [selectedGroup, setSelectedGroup] = useState<(typeof BLOOD_GROUPS)[number]>("All");
  const [maxDistanceKmText, setMaxDistanceKmText] = useState<string>("5");
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  const maxDistanceKm = useMemo(() => {
    const n = Number(maxDistanceKmText);
    return Number.isFinite(n) && n > 0 ? n : 5;
  }, [maxDistanceKmText]);

  const fetchDonorsFromApi = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setApiError("");

    try {
      const params = new URLSearchParams();
      if (selectedGroup !== "All") params.set("bloodGroup", selectedGroup);
      params.set("eligibleOnly", eligibleOnly ? "1" : "0");
      params.set("limit", "50");
      params.set("offset", "0");

      const res = await fetch(`${API_BASE}/donors?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const data = (await res.json()) as ApiGetDonorsResponse;
      if (!data.ok) throw new Error("API returned ok=false");

      const mapped: Donor[] = data.items.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        bloodGroup: d.bloodGroup,
        area: d.area,
        profileImage: d.profileImage,
        lat: d.lat,
        lon: d.lon,
        availableNow: true,
        lastDonated: normalizeLastDonated(d.lastDonated),
      }));

      if (seq === fetchSeqRef.current) {
        setApiDonors(mapped);
        setApiTotal(data.total ?? mapped.length);
      }
    } catch (e: any) {
      if (seq === fetchSeqRef.current) {
        setApiError(e?.message || "Failed to load donors");
        setApiDonors([]);
        setApiTotal(0);
      }
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, [eligibleOnly, selectedGroup]);

  const requestMyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionStatus("denied");
        return;
      }

      setPermissionStatus("granted");

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setMyLat(pos.coords.latitude);
      setMyLon(pos.coords.longitude);
    } catch {
      Alert.alert("Location error", "Could not get your GPS location.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (permissionStatus === "idle") requestMyLocation();
      fetchDonorsFromApi();
    }, [fetchDonorsFromApi, permissionStatus, requestMyLocation]),
  );

  const computedList = useMemo(() => {
    const today = new Date();

    return apiDonors
      .map((d) => {
        const distance =
          myLat != null && myLon != null ? haversineKm(myLat, myLon, d.lat, d.lon) : null;

        const last = d.lastDonated ? safeParseDateYYYYMMDD(normalizeLastDonated(d.lastDonated)) : null;
        let eligible = true;
        let daysLeft = 0;
        let nextEligibleDate = "";

        if (d.lastDonated && last) {
          const passed = daysBetween(last, today);
          eligible = passed >= 90;
          daysLeft = eligible ? 0 : 90 - passed;

          const next = new Date(last.getTime());
          next.setDate(next.getDate() + 90);
          nextEligibleDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        } else if (d.lastDonated) {
          eligible = false;
        }

        return { donor: d, distance, eligible, daysLeft, nextEligibleDate };
      })
      .filter(({ donor, distance, eligible }) => {
        if (selectedGroup !== "All" && donor.bloodGroup !== selectedGroup) return false;
        if (distance != null && distance > maxDistanceKm) return false;
        if (eligibleOnly && !eligible) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return a.donor.name.localeCompare(b.donor.name);
      });
  }, [apiDonors, eligibleOnly, maxDistanceKm, myLat, myLon, selectedGroup]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="water-outline" size={22} color="#fff" />
        </View>
        <Text style={styles.title}>Find blood donors nearby</Text>
        <Text style={styles.subtitle}>
          Browse active donors by blood group, location, and eligibility without leaving the app.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Location</Text>
          <TouchableOpacity style={styles.inlineButton} onPress={requestMyLocation}>
            <Ionicons name="locate-outline" size={16} color={Colors.light.tint} />
            <Text style={styles.inlineButtonText}>Refresh GPS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="navigate-outline" size={16} color={Colors.light.icon} />
          <Text style={styles.muted}>
            {myLat != null && myLon != null
              ? `Using your live location`
              : "GPS is optional. You can still browse the donor directory."}
          </Text>
        </View>
        <Text style={styles.microText}>
          Permission: {permissionStatus === "idle" ? "Not requested" : permissionStatus}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Filters</Text>

        <Text style={styles.label}>Blood Group</Text>
        <View style={styles.chipsRow}>
          {BLOOD_GROUPS.map((bg) => {
            const active = selectedGroup === bg;
            return (
              <TouchableOpacity
                key={bg}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedGroup(bg)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{bg}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Max Distance</Text>
        <View style={styles.row}>
          <TextInput
            value={maxDistanceKmText}
            onChangeText={setMaxDistanceKmText}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={[styles.input, { flex: 1 }]}
            placeholder="5"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
          />
          <TouchableOpacity
            style={[styles.quickBtn, maxDistanceKmText === "2" && styles.quickBtnActive]}
            onPress={() => setMaxDistanceKmText("2")}
          >
            <Text style={[styles.quickBtnText, maxDistanceKmText === "2" && styles.quickBtnTextActive]}>2 km</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, maxDistanceKmText === "5" && styles.quickBtnActive]}
            onPress={() => setMaxDistanceKmText("5")}
          >
            <Text style={[styles.quickBtnText, maxDistanceKmText === "5" && styles.quickBtnTextActive]}>5 km</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.toggle, eligibleOnly && styles.toggleActive]}
          onPress={() => setEligibleOnly((prev) => !prev)}
        >
          <Ionicons
            name={eligibleOnly ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={eligibleOnly ? "#fff" : Colors.light.icon}
          />
          <Text style={[styles.toggleText, eligibleOnly && styles.toggleTextActive]}>
            Eligible donors only
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={fetchDonorsFromApi}>
          <Ionicons name="refresh-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{isLoading ? "Refreshing..." : "Refresh results"}</Text>
        </TouchableOpacity>

        <Text style={styles.microText}>
          {computedList.length} shown from {apiTotal} available donors
        </Text>
        {apiError ? <Text style={styles.errorText}>API error: {apiError}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Results</Text>
          <Text style={styles.microText}>{computedList.length} donors</Text>
        </View>

        {computedList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={20} color={Colors.light.icon} />
            <Text style={styles.muted}>No donors match these filters right now.</Text>
          </View>
        ) : (
          computedList.map(({ donor, distance, eligible, daysLeft, nextEligibleDate }) => {
            const eligibleText = eligible
              ? "Eligible now"
              : nextEligibleDate
                ? `Eligible in ${daysLeft} days`
                : "Not eligible";

            return (
              <TouchableOpacity
                key={donor.id}
                style={styles.donorRow}
                onPress={() => {
                  router.push({
                    pathname: "/donor/[id]" as const,
                    params: {
                      id: donor.id,
                      distance: distance == null ? "" : distance.toFixed(2),
                      lat: String(donor.lat),
                      lon: String(donor.lon),
                      eligible: String(eligible),
                      daysLeft: String(daysLeft),
                      nextEligibleDate,
                    },
                  });
                }}
              >
                <View style={styles.avatarWrap}>
                  {donor.profileImage ? (
                    <Image source={{ uri: donor.profileImage }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarFallback}>{firstInitial(donor.name)}</Text>
                  )}
                </View>

                <View style={styles.donorCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.donorName}>{donor.name}</Text>
                    <View style={styles.groupBadge}>
                      <Text style={styles.groupBadgeText}>{donor.bloodGroup}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.light.icon} />
                    <Text style={styles.muted}>{donor.area}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="navigate-outline" size={14} color={Colors.light.icon} />
                    <Text style={styles.muted}>{distanceLabel(distance)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons
                      name={eligible ? "checkmark-circle-outline" : "time-outline"}
                      size={14}
                      color={eligible ? Colors.light.success : Colors.light.warning}
                    />
                    <Text style={[styles.statusText, { color: eligible ? Colors.light.success : Colors.light.warning }]}>
                      {eligibleText}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={Colors.light.icon} />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    backgroundColor: Colors.light.background,
  },
  hero: {
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    color: "#fde8ef",
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.light.text,
  },
  inlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#fceef3",
  },
  inlineButtonText: {
    color: Colors.light.tint,
    fontWeight: "700",
  },
  label: {
    fontWeight: "700",
    color: Colors.light.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint,
  },
  chipText: {
    color: Colors.light.text,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.light.surface,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  quickBtnText: {
    fontWeight: "700",
    color: Colors.light.text,
  },
  quickBtnTextActive: {
    color: "#fff",
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  toggleActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  toggleText: {
    fontWeight: "800",
    color: Colors.light.text,
  },
  toggleTextActive: {
    color: "#fff",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  donorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  donorCopy: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  donorName: {
    fontWeight: "800",
    fontSize: 16,
    color: Colors.light.text,
  },
  groupBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fceef3",
  },
  groupBadgeText: {
    color: Colors.light.tint,
    fontWeight: "800",
    fontSize: 12,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 22,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    fontWeight: "700",
  },
  muted: {
    color: "#526077",
  },
  microText: {
    color: Colors.light.icon,
    fontSize: 12,
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  errorText: {
    color: Colors.light.danger,
    fontWeight: "700",
  },
});
