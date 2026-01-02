// app/(tabs)/donor.tsx
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { addDonor, loadDonors } from "../lib/donorsStore";

type Donor = {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lat: number;
  lon: number;
  availableNow: boolean; // kept for compatibility; eligibility is computed in Find screen
  lastDonated: string; // YYYY-MM-DD
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export default function BecomeDonorScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [area, setArea] = useState("");
  const [lastDonated, setLastDonated] = useState("");

  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "granted" | "denied" | "error">(
    "idle"
  );
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const canRegister = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      phone.trim().length >= 8 &&
      bloodGroup !== "" &&
      area.trim().length >= 2 &&
      /^\d{4}-\d{2}-\d{2}$/.test(lastDonated.trim())
    );
  }, [name, phone, bloodGroup, area, lastDonated]);

  async function captureLocation() {
    try {
      setLocStatus("loading");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocStatus("denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
      setLocStatus("granted");
    } catch {
      setLocStatus("error");
    }
  }

  // Auto-capture by default (best for demo)
  useEffect(() => {
    captureLocation();
  }, []);

  function normalizePhone(p: string) {
    // simple normalization: remove spaces
    return p.replace(/\s+/g, "").trim();
  }

  async function onRegister() {
    if (!canRegister) {
      Alert.alert(
        "Incomplete form",
        "Please fill all fields correctly.\n\nLast donated must be in YYYY-MM-DD format."
      );
      return;
    }

    const phoneNorm = normalizePhone(phone);

    // Prevent duplicate donor by phone (demo-friendly)
    const existing = await loadDonors();
    const already = existing.find((d: any) => normalizePhone(String(d.phone || "")) === phoneNorm);
    if (already) {
      Alert.alert(
        "Already registered",
        "This phone number is already registered as a donor.\n\nUse a different phone number."
      );
      return;
    }

    const donor: Donor = {
      id: String(Date.now()),
      name: name.trim(),
      phone: phoneNorm,
      bloodGroup,
      area: area.trim(),
      lat: lat ?? 0,
      lon: lon ?? 0,
      availableNow: true,
      lastDonated: lastDonated.trim(),
    };

    await addDonor(donor);

    Alert.alert("Success ✅", "You are registered as a donor!", [
      {
        text: "OK",
        onPress: () => router.push("/" as const), // back to Find Donors tab (index)
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Become a Donor</Text>
      <Text style={styles.subtitle}>Register locally (AsyncStorage) for demo.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Rahim Uddin"
          style={styles.input}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 017xxxxxxxx"
          keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
          style={styles.input}
        />

        <Text style={styles.label}>Blood Group</Text>
        <View style={styles.chipsRow}>
          {BLOOD_GROUPS.map((bg) => {
            const active = bloodGroup === bg;
            return (
              <TouchableOpacity
                key={bg}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setBloodGroup(bg)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{bg}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Area (Text)</Text>
        <TextInput
          value={area}
          onChangeText={setArea}
          placeholder="e.g. Mirpur 10"
          style={styles.input}
        />

        <Text style={styles.label}>Last Donated (YYYY-MM-DD)</Text>
        <TextInput
          value={lastDonated}
          onChangeText={setLastDonated}
          placeholder="e.g. 2025-10-01"
          style={styles.input}
        />

        <View style={styles.locationBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Location (Auto)</Text>
            <Text style={styles.locationText}>
              {lat != null && lon != null
                ? `Lat: ${lat.toFixed(6)} | Lon: ${lon.toFixed(6)}`
                : locStatus === "loading"
                ? "Getting location..."
                : locStatus === "denied"
                ? "Permission denied (will save 0,0)"
                : locStatus === "error"
                ? "Location error (will save 0,0)"
                : "Not captured"}
            </Text>
          </View>

          <TouchableOpacity style={styles.smallBtn} onPress={captureLocation}>
            <Text style={styles.smallBtnText}>Use my GPS</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !canRegister && styles.primaryBtnDisabled]}
          onPress={onRegister}
        >
          <Text style={styles.primaryBtnText}>Register Donor</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Note: If GPS isn’t available, the donor will still save (lat/lon becomes 0,0). Distance
          sorting will work best when GPS is captured.
        </Text>
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
  subtitle: {
    color: "#666",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  label: {
    fontWeight: "600",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
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
  locationBox: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fafafa",
  },
  locationText: {
    color: "#444",
    marginTop: 4,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  smallBtnText: {
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  note: {
    marginTop: 10,
    color: "#666",
    fontSize: 12,
    lineHeight: 16,
  },
});
