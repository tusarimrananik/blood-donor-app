import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Redirect } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { Image } from "expo-image";
import { useAuth } from "@/app/lib/auth";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

export default function AuthScreen() {
  const { isAuthenticated, login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [bloodGroup, setBloodGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [area, setArea] = useState("");
  const [lastDonated, setLastDonated] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number] | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [canDonate, setCanDonate] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const readyForRegister = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      email.trim().length > 3 &&
      phone.trim().length >= 8 &&
      password.length >= 6 &&
      bloodGroup !== "" &&
      area.trim().length >= 2 &&
      /^\d{4}-\d{2}-\d{2}$/.test(lastDonated) &&
      gender !== "" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    );
  }, [area, bloodGroup, dateOfBirth, email, gender, lastDonated, name, password, phone]);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow photo access to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Image error", "Could not read the selected image.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    setProfileImage(`data:${mimeType};base64,${asset.base64}`);
  };

  const captureLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Location unavailable", "Location permission was denied.");
      return;
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLat(position.coords.latitude);
    setLon(position.coords.longitude);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email.trim().toLowerCase(), password);
      } else {
        if (!readyForRegister) {
          throw new Error("Please fill all required fields before registering.");
        }

        await register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          bloodGroup,
          area: area.trim(),
          lastDonated,
          gender,
          dateOfBirth,
          profileImage,
          canDonate,
          lat: lat ?? 0,
          lon: lon ?? 0,
        });
      }
    } catch (e: any) {
      Alert.alert(mode === "login" ? "Login failed" : "Registration failed", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>BloodLink</Text>
        <Text style={styles.heroSubtitle}>
          Sign in to request blood, manage your donor profile, and respond to urgent community needs.
        </Text>
      </View>

      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[styles.switchBtn, mode === "login" && styles.switchBtnActive]}
          onPress={() => setMode("login")}
        >
          <Text style={[styles.switchText, mode === "login" && styles.switchTextActive]}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, mode === "register" && styles.switchBtnActive]}
          onPress={() => setMode("register")}
        >
          <Text style={[styles.switchText, mode === "register" && styles.switchTextActive]}>Register</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {mode === "register" ? (
          <>
            <TouchableOpacity style={styles.avatarPicker} onPress={pickProfileImage}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarPlaceholder}>Add Photo</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.label}>Full Name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your full name" />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              placeholder="017xxxxxxxx"
              keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
            />

            <Text style={styles.label}>Blood Group</Text>
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

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipsRow}>
              {GENDERS.map((item) => {
                const active = gender === item;
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setGender(item)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Area</Text>
            <TextInput value={area} onChangeText={setArea} style={styles.input} placeholder="Mirpur, Dhaka" />

            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />

            <Text style={styles.label}>Last Donated</Text>
            <TextInput
              value={lastDonated}
              onChangeText={setLastDonated}
              style={styles.input}
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />

            <TouchableOpacity
              style={[styles.toggle, canDonate && styles.toggleActive]}
              onPress={() => setCanDonate((value) => !value)}
            >
              <Text style={[styles.toggleText, canDonate && styles.toggleTextActive]}>
                Ready to donate: {canDonate ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={captureLocation}>
              <Text style={styles.secondaryBtnText}>
                {lat != null && lon != null ? "Refresh location" : "Use current location"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.helperText}>
              {lat != null && lon != null ? `Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)}` : "Location not captured yet"}
            </Text>
          </>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="At least 6 characters"
          secureTextEntry
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={submitting}>
          <Text style={styles.primaryBtnText}>
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </Text>
        </TouchableOpacity>

        {mode === "register" ? (
          <Text style={styles.helperText}>
            Registration saves your donor identity, profile picture, and personal details directly in the database.
          </Text>
        ) : null}
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
    backgroundColor: "#7c1637",
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
  },
  heroSubtitle: {
    color: "#fce7ef",
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 999,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  switchBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  switchBtnActive: {
    backgroundColor: "#111827",
  },
  switchText: {
    fontWeight: "700",
    color: "#374151",
  },
  switchTextActive: {
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  avatarPicker: {
    alignSelf: "center",
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 6,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    color: "#6b7280",
    fontWeight: "700",
  },
  label: {
    fontWeight: "700",
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fafafa",
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
  toggle: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  toggleText: {
    fontWeight: "800",
    color: "#111827",
  },
  toggleTextActive: {
    color: "#fff",
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#7c1637",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#111827",
    fontWeight: "700",
  },
  helperText: {
    color: "#6b7280",
    lineHeight: 18,
  },
});
