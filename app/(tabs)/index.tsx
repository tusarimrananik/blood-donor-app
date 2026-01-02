// app/(tabs)/index.tsx
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { loadDonors } from "../lib/donorsStore";

type Donor = {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lat: number;
  lon: number;
  availableNow: boolean;
  lastDonated: string; // YYYY-MM-DD
};

const BLOOD_GROUPS = ["All", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

const MOCK_DONORS: Donor[] = [
  {
    id: "1",
    name: "Rahim",
    phone: "01711111111",
    bloodGroup: "A+",
    area: "Mirpur",
    lat: 23.8041,
    lon: 90.3667,
    availableNow: true,
    lastDonated: "2025-08-01",
  },
  {
    id: "2",
    name: "Karim",
    phone: "01722222222",
    bloodGroup: "O+",
    area: "Dhanmondi",
    lat: 23.7461,
    lon: 90.3742,
    availableNow: true,
    lastDonated: "2025-12-01",
  },
];

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
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // validate round-trip
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export default function FindDonorsScreen() {
  const router = useRouter();

  const [permissionStatus, setPermissionStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLon, setMyLon] = useState<number | null>(null);

  const [storedDonors, setStoredDonors] = useState<Donor[]>([]);

  const [selectedGroup, setSelectedGroup] = useState<(typeof BLOOD_GROUPS)[number]>("All");
  const [maxDistanceKmText, setMaxDistanceKmText] = useState<string>("5");
  const [eligibleOnly, setEligibleOnly] = useState<boolean>(false);

  async function requestMyLocation() {
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
  }

  const reloadStoredDonors = useCallback(async () => {
    const d = await loadDonors();
    // Ensure array + basic shape
    setStoredDonors(Array.isArray(d) ? (d as Donor[]) : []);
  }, []);

  // When screen is focused (coming back from Become Donor), reload donors
  useFocusEffect(
    useCallback(() => {
      reloadStoredDonors();
      // Also request location on focus if not already granted
      if (permissionStatus === "idle") requestMyLocation();
    }, [reloadStoredDonors, permissionStatus])
  );

  const allDonors: Donor[] = useMemo(() => {
    // Merge stored + mock
    // If IDs collide, stored wins (rare)
    const map = new Map<string, Donor>();
    for (const d of MOCK_DONORS) map.set(d.id, d);
    for (const d of storedDonors) map.set(d.id, d);
    return Array.from(map.values());
  }, [storedDonors]);

  const maxDistanceKm = useMemo(() => {
    const n = Number(maxDistanceKmText);
    return Number.isFinite(n) && n > 0 ? n : 5;
  }, [maxDistanceKmText]);

  const computedList = useMemo(() => {
    if (myLat == null || myLon == null) return [];

    const today = new Date();

    return allDonors
      .map((d) => {
        const distance = haversineKm(myLat, myLon, d.lat, d.lon);

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
          // If date invalid, treat as not eligible (safer for demo)
          eligible = false;
          daysLeft = 0;
          nextEligibleDate = "";
        }

        return { donor: d, distance, eligible, daysLeft, nextEligibleDate };
      })
      .filter((x) => {
        const { donor, distance, eligible } = x;

        if (selectedGroup !== "All" && donor.bloodGroup !== selectedGroup) return false;
        if (distance > maxDistanceKm) return false;
        if (eligibleOnly && !eligible) return false;

        return true;
      })
      .sort((a, b) => a.distance - b.distance);
  }, [allDonors, myLat, myLon, selectedGroup, maxDistanceKm, eligibleOnly]);

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
            : "Location not available yet."}
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

        <Text style={styles.muted}>
          Stored donors: {storedDonors.length} | Total donors: {allDonors.length}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Results</Text>

        {myLat == null || myLon == null ? (
          <Text style={styles.muted}>Tap “Get My GPS” to see nearby donors.</Text>
        ) : computedList.length === 0 ? (
          <Text style={styles.muted}>No donors match your filters.</Text>
        ) : (
          computedList.map(({ donor, distance, eligible, daysLeft, nextEligibleDate }) => {
            const eligibleText = eligible
              ? "✅ Eligible"
              : nextEligibleDate
              ? `⏳ Eligible in ${daysLeft} days (${nextEligibleDate})`
              : "⏳ Not eligible";

            return (
              <TouchableOpacity
                key={donor.id}
                style={styles.donorRow}
                onPress={() => {
                  router.push({
                    pathname: "/donor/[id]" as const,
                    params: {
                      id: donor.id,
                      distance: distance.toFixed(2),
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
                    {donor.area} • {distance.toFixed(2)} km
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
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  muted: {
    color: "#666",
  },
  label: {
    fontWeight: "700",
    marginTop: 6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  chipText: {
    color: "#111",
    fontWeight: "600",
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
  },
  quickBtnText: {
    fontWeight: "800",
  },
  toggle: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  toggleText: {
    fontWeight: "800",
    color: "#111",
  },
  toggleTextActive: {
    color: "#fff",
  },
  donorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  donorName: {
    fontWeight: "800",
    fontSize: 16,
  },
  eligibility: {
    marginTop: 4,
    fontWeight: "700",
  },
  chev: {
    fontSize: 26,
    color: "#999",
    paddingHorizontal: 6,
  },
});
