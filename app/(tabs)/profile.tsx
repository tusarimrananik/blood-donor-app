import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useAuth } from "@/app/lib/auth";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

export default function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState<(typeof BLOOD_GROUPS)[number] | "">("");
  const [area, setArea] = useState("");
  const [lastDonated, setLastDonated] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number] | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [canDonate, setCanDonate] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setBloodGroup(user.bloodGroup as (typeof BLOOD_GROUPS)[number]);
    setArea(user.area);
    setLastDonated(user.lastDonated.slice(0, 10));
    setGender((user.gender as (typeof GENDERS)[number]) || "");
    setDateOfBirth(user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
    setProfileImage(user.profileImage);
    setCanDonate(user.canDonate);
    setLat(user.lat);
    setLon(user.lon);
  }, [user]);

  const profileCompletion = useMemo(() => {
    const fields = [name, phone, bloodGroup, area, lastDonated, gender, dateOfBirth, profileImage];
    const filled = fields.filter((value) => Boolean(value)).length;
    return `${Math.round((filled / fields.length) * 100)}%`;
  }, [area, bloodGroup, dateOfBirth, gender, lastDonated, name, phone, profileImage]);

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

    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    setProfileImage(`data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`);
  };

  const refreshLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Location unavailable", "Location permission was denied.");
      return;
    }

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLat(pos.coords.latitude);
    setLon(pos.coords.longitude);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);

    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
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

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await logout();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickProfileImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatar} contentFit="cover" />
          ) : (
            <Text style={styles.avatarFallback}>{name ? name.slice(0, 1).toUpperCase() : "U"}</Text>
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{user?.name || "Your Profile"}</Text>
          <Text style={styles.subtitle}>{user?.email || "Manage your donor account"}</Text>
          <Text style={styles.helper}>Profile completion: {profileCompletion}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Available For Donation</Text>
            <Text style={styles.helper}>
              Turn this off when you do not want to appear in the donor list.
            </Text>
          </View>
          <Switch value={canDonate} onValueChange={setCanDonate} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
        />

        <Text style={styles.label}>Area</Text>
        <TextInput value={area} onChangeText={setArea} style={styles.input} />

        <Text style={styles.label}>Date of Birth</Text>
        <TextInput value={dateOfBirth} onChangeText={setDateOfBirth} style={styles.input} maxLength={10} />

        <Text style={styles.label}>Last Donated</Text>
        <TextInput value={lastDonated} onChangeText={setLastDonated} style={styles.input} maxLength={10} />

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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location & Actions</Text>
        <Text style={styles.helper}>
          {lat != null && lon != null ? `Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)}` : "No location saved"}
        </Text>

        <TouchableOpacity style={styles.secondaryBtn} onPress={refreshLocation}>
          <Text style={styles.secondaryBtnText}>Refresh location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={save}>
          <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save profile"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
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
    backgroundColor: "#102a43",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1d4ed8",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#d9e2ec",
    marginTop: 4,
  },
  helper: {
    color: "#6b7280",
    marginTop: 6,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  label: {
    marginTop: 4,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#111827",
    fontWeight: "700",
  },
  primaryBtn: {
    backgroundColor: "#102a43",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  logoutBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fee2e2",
  },
  logoutBtnText: {
    color: "#b91c1c",
    fontWeight: "800",
  },
});
