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

type Donor = {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lat: number;
  lon: number;
  availableNow?: boolean;
  lastDonated: string; // normalized to YYYY-MM-DD
};

const BLOOD_GROUPS = ["All", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

type ApiGetDonorsResponse = {
  ok: boolean;
  total: number;
  items: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string;
    bloodGroup: string;
    area: string;
    lastDonated: string; // ISO string from backend
    lat: number;
    lon: number;
  }>;
  limit?: number;
  offset?: number;
  bloodGroup?: string;
  eligibleOnly?: boolean;
};

export default function FindDonorsScreen() {
  const router = useRouter();

  const [permissionStatus, setPermissionStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLon, setMyLon] = useState<number | null>(null);

  const [apiDonors, setApiDonors] = useState<Donor[]>([]);
  const [apiTotal, setApiTotal] = useState<number>(0);

  const [selectedGroup, setSelectedGroup] = useState<(typeof BLOOD_GROUPS)[number]>("All");
  const [maxDistanceKmText, setMaxDistanceKmText] = useState<string>("5");

  // ✅ Toggle wired to backend now
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  // To avoid stale responses overwriting newer ones
  const fetchSeqRef = useRef(0);

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

      // ✅ ONLY server filter: bloodGroup
      // (Distance filtering is client-side using GPS if available)
      if (selectedGroup !== "All") params.set("bloodGroup", selectedGroup); // AB+ auto-encodes to AB%2B

      // ✅ Eligible toggle controls backend mode
      params.set("eligibleOnly", eligibleOnly ? "1" : "0");

      params.set("limit", "50");
      params.set("offset", "0");

      const url = `${API_BASE}/donors?${params.toString()}`;

      const res = await fetch(url);
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
  }, [selectedGroup, eligibleOnly]);

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

      // ✅ IMPORTANT: DO NOT refetch donors here.
      // GPS is only used for client-side distance filtering.
    } catch {
      Alert.alert("Location error", "Could not get your GPS location.");
    }
  }, []);

  // Fetch donors on focus
  useFocusEffect(
    useCallback(() => {
      if (permissionStatus === "idle") requestMyLocation();
      fetchDonorsFromApi();
    }, [permissionStatus, requestMyLocation, fetchDonorsFromApi])
  );

  const computedList = useMemo(() => {
    const today = new Date();

    return apiDonors
      .map((d) => {
        const distance =
          myLat != null && myLon != null ? haversineKm(myLat, myLon, d.lat, d.lon) : null;

        const last = safeParseDateYYYYMMDD(d.lastDonated);
        let eligible = true;
        let daysLeft = 0;
        let nextEligibleDate = "";

        if (last) {
          const passed = daysBetween(last, today);
          eligible = passed >= 90;
          daysLeft = eligible ? 0 : 90 - passed;

          const next = new Date(last.getTime());
          next.setDate(next.getDate() + 90);
          const yyyy = next.getFullYear();
          const mm = String(next.getMonth() + 1).padStart(2, "0");
          const dd = String(next.getDate()).padStart(2, "0");
          nextEligibleDate = `${yyyy}-${mm}-${dd}`;
        } else {
          eligible = false;
          daysLeft = 0;
          nextEligibleDate = "";
        }

        return { donor: d, distance, eligible, daysLeft, nextEligibleDate };
      })
      .filter((x) => {
        const { donor, distance, eligible } = x;

        if (selectedGroup !== "All" && donor.bloodGroup !== selectedGroup) return false;

        // ✅ Apply distance filter ONLY if we have GPS
        if (distance != null && distance > maxDistanceKm) return false;

        // ✅ Toggle filters client-side too (backend already respects it)
        if (eligibleOnly && !eligible) return false;

        return true;
      })
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return a.donor.name.localeCompare(b.donor.name);
      });
  }, [apiDonors, myLat, myLon, selectedGroup, maxDistanceKm, eligibleOnly]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Find Donors</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Location</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={requestMyLocation}>
          <Text style={styles.primaryBtnText}>Get My GPS</Text>
        </TouchableOpacity>

        <Text style={styles.muted}>
          Permission: {permissionStatus === "idle" ? "Not requested" : permissionStatus}
        </Text>
        <Text style={styles.muted}>
          {myLat != null && myLon != null
            ? `Lat: ${myLat.toFixed(6)} | Lon: ${myLon.toFixed(6)}`
            : "GPS not available (still showing donors)."}
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

        <Text style={styles.label}>Max Distance (km)</Text>
        <Text style={styles.muted}>(Distance filter works only after GPS is available)</Text>

        <View style={styles.row}>
          <TextInput
            value={maxDistanceKmText}
            onChangeText={setMaxDistanceKmText}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g. 5"
          />
          <TouchableOpacity style={styles.quickBtn} onPress={() => setMaxDistanceKmText("2")}>
            <Text style={styles.quickBtnText}>2km</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setMaxDistanceKmText("5")}>
            <Text style={styles.quickBtnText}>5km</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.toggle, eligibleOnly && styles.toggleActive]}
          onPress={() => setEligibleOnly((p) => !p)}
        >
          <Text style={[styles.toggleText, eligibleOnly && styles.toggleTextActive]}>
            Eligible only: {eligibleOnly ? "ON" : "OFF"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickBtn} onPress={fetchDonorsFromApi}>
          <Text style={styles.quickBtnText}>{isLoading ? "Loading..." : "Refresh from API"}</Text>
        </TouchableOpacity>

        <Text style={styles.muted}>
          API donors loaded: {apiDonors.length} | API total: {apiTotal} | Mode:{" "}
          {eligibleOnly ? "Eligible-only" : "All donors"}
        </Text>

        {apiError ? <Text style={styles.errorText}>API error: {apiError}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Results</Text>

        {computedList.length === 0 ? (
          <Text style={styles.muted}>No donors match your filters.</Text>
        ) : (
          computedList.map(({ donor, distance, eligible, daysLeft, nextEligibleDate }) => {
            const eligibleText = eligible
              ? "✅ Eligible"
              : nextEligibleDate
              ? `⏳ Eligible in ${daysLeft} days (${nextEligibleDate})`
              : "⏳ Not eligible";

            const distanceText =
              distance == null ? "Distance: GPS off" : `${distance.toFixed(2)} km`;

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
                      nextEligibleDate: nextEligibleDate,
                    },
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.donorName}>
                    {donor.name} • {donor.bloodGroup}
                  </Text>
                  <Text style={styles.muted}>
                    {donor.area} • {distanceText}
                  </Text>
                  <Text style={styles.eligibility}>{eligibleText}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  muted: { color: "#666" },
  errorText: { color: "#b00020", fontWeight: "800" },
  label: { fontWeight: "700", marginTop: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#111", backgroundColor: "#111" },
  chipText: { color: "#111", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  quickBtnText: { fontWeight: "800" },
  toggle: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleActive: { backgroundColor: "#111", borderColor: "#111" },
  toggleText: { fontWeight: "800", color: "#111" },
  toggleTextActive: { color: "#fff" },
  donorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  donorName: { fontWeight: "800", fontSize: 16 },
  eligibility: { marginTop: 4, fontWeight: "700" },
  chev: { fontSize: 26, color: "#999", paddingHorizontal: 6 },
});
