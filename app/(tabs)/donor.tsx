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
import { API_BASE } from "@/constants/api";

type DonorPayload = {
  name: string;
  phone: string;
  email: string;
  bloodGroup: string;
  area: string;
  lastDonated: string; // YYYY-MM-DD (backend expects this)
  lat: number;
  lon: number;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export default function BecomeDonorScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bloodGroup, setBloodGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [area, setArea] = useState("");
  const [lastDonated, setLastDonated] = useState("");

  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "granted" | "denied" | "error">(
    "idle"
  );
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);

  function normalizePhone(p: string) {
    return p.replace(/\s+/g, "").trim();
  }

  function normalizeEmail(e: string) {
    return e.trim().toLowerCase();
  }

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  const validation = useMemo(() => {
    const nameOk = name.trim().length >= 2;
    const phoneOk = normalizePhone(phone).length >= 8;
    const emailOk = isValidEmail(normalizeEmail(email));
    const bloodOk = bloodGroup !== "";
    const areaOk = area.trim().length >= 2;
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(lastDonated.trim());
    return { nameOk, phoneOk, emailOk, bloodOk, areaOk, dateOk };
  }, [name, phone, email, bloodGroup, area, lastDonated]);

  const canRegister = useMemo(() => {
    return (
      validation.nameOk &&
      validation.phoneOk &&
      validation.emailOk &&
      validation.bloodOk &&
      validation.areaOk &&
      validation.dateOk
    );
  }, [validation]);

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

  useEffect(() => {
    captureLocation();
  }, []);

  async function onRegister() {
    if (submitting) return;

    if (!canRegister) {
      const reasons: string[] = [];
      if (!validation.nameOk) reasons.push("• Name must be at least 2 letters");
      if (!validation.phoneOk) reasons.push("• Phone must be at least 8 digits");
      if (!validation.emailOk) reasons.push("• Email must be valid");
      if (!validation.bloodOk) reasons.push("• Select a blood group");
      if (!validation.areaOk) reasons.push("• Area must be at least 2 letters");
      if (!validation.dateOk) reasons.push("• Last donated must be YYYY-MM-DD");
      Alert.alert("Incomplete form", reasons.join("\n") || "Please fill all fields correctly.");
      return;
    }

    setSubmitting(true);

    try {
      const phoneNorm = normalizePhone(phone);
      const emailNorm = normalizeEmail(email);

      const payload: DonorPayload = {
        name: name.trim(),
        phone: phoneNorm,
        email: emailNorm,
        bloodGroup: bloodGroup as string,
        area: area.trim(),
        lastDonated: lastDonated.trim(), // ✅ send YYYY-MM-DD
        lat: lat ?? 0,
        lon: lon ?? 0,
      };

      const res = await fetch(`${API_BASE}/donors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const fieldErrors = json?.errors?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === "object") {
          const lines: string[] = [];
          for (const k of Object.keys(fieldErrors)) {
            const arr = fieldErrors[k];
            if (Array.isArray(arr)) lines.push(`• ${k}: ${arr.join(", ")}`);
          }
          if (lines.length) throw new Error(lines.join("\n"));
        }

        const msg = (json && (json.message || json.error)) || `Request failed (HTTP ${res.status})`;
        const lower = String(msg).toLowerCase();
        if (lower.includes("phone") && (lower.includes("unique") || lower.includes("duplicate"))) {
          throw new Error("This phone number is already registered.");
        }
        if (lower.includes("email") && (lower.includes("unique") || lower.includes("duplicate"))) {
          throw new Error("This email is already registered.");
        }
        throw new Error(msg);
      }

      Alert.alert("Success ✅", "You are registered as a donor!", [
        { text: "OK", onPress: () => router.push("/" as const) },
      ]);

      setName("");
      setPhone("");
      setEmail("");
      setBloodGroup("");
      setArea("");
      setLastDonated("");
    } catch (e: any) {
      Alert.alert("Registration failed", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const visuallyDisabled = !canRegister || submitting;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Become a Donor</Text>
      <Text style={styles.subtitle}>Registers to backend (Neon + Prisma + PostGIS).</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Rahim Uddin" style={styles.input} />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 017xxxxxxxx"
          keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
          style={styles.input}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. rahim@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
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

        <Text style={styles.label}>Area</Text>
        <TextInput value={area} onChangeText={setArea} placeholder="e.g. Mirpur 10" style={styles.input} />

        <Text style={styles.label}>Last Donated (YYYY-MM-DD)</Text>
        <TextInput
          value={lastDonated}
          onChangeText={setLastDonated}
          placeholder="e.g. 2025-09-01"
          maxLength={10}
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
          style={[styles.primaryBtn, visuallyDisabled && styles.primaryBtnDisabled]}
          onPress={onRegister}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "Registering..." : "Register Donor"}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Tip: If you register with a recent lastDonated, you won’t show in Eligible-only mode.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#666", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  label: { fontWeight: "600", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fafafa",
  },
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
  locationText: { color: "#444", marginTop: 4 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  smallBtnText: { fontWeight: "700" },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  note: { marginTop: 10, color: "#666", fontSize: 12, lineHeight: 16 },
});
