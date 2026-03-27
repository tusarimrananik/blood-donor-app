import { Ionicons } from "@expo/vector-icons";
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
import { useAuth } from "@/lib/auth";
import { Colors } from "@/constants/theme";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const GENDERS = ["Male", "Female", "Other"] as const;
const PLACEHOLDER_TEXT_COLOR = "#8b95a7";

function firstInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

function formatDateLabel(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statCompletion(fields: Array<string | null | undefined>) {
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

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
  const [isEditing, setIsEditing] = useState(false);

  const hydrateFromUser = () => {
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
  };

  useEffect(() => {
    hydrateFromUser();
  }, [user]);

  const profileCompletion = useMemo(
    () => statCompletion([name, phone, bloodGroup, area, lastDonated, gender, dateOfBirth, profileImage]),
    [area, bloodGroup, dateOfBirth, gender, lastDonated, name, phone, profileImage],
  );

  const locationLabel =
    lat != null && lon != null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : "Location not saved";

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

      setIsEditing(false);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    hydrateFromUser();
    setIsEditing(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
            <Text style={styles.heroBadgeText}>Donor profile</Text>
          </View>

          {!isEditing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={16} color={Colors.light.text} />
              <Text style={styles.editBtnText}>Edit profile</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.heroIdentityCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={isEditing ? pickProfileImage : undefined}
            activeOpacity={isEditing ? 0.85 : 1}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} contentFit="cover" />
            ) : (
              <Text style={styles.avatarFallback}>{firstInitial(name || user?.name || "")}</Text>
            )}
            {isEditing ? (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera-outline" size={14} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={styles.heroCopy}>
            <Text style={styles.title}>{user?.name || "Your Profile"}</Text>
            <Text style={styles.subtitle}>{user?.email || "Manage your donor account"}</Text>
          </View>

          <View style={styles.identityGrid}>
            <View style={styles.identityPill}>
              <View style={styles.identityIconWrap}>
                <Ionicons name="water-outline" size={15} color={Colors.light.tint} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>Blood Group</Text>
                <Text style={styles.identityValue}>{bloodGroup || "Not set"}</Text>
              </View>
            </View>

            <View style={styles.identityPill}>
              <View style={styles.identityIconWrap}>
                <Ionicons name="location-outline" size={15} color={Colors.light.tint} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>Location</Text>
                <Text style={styles.identityValue}>{area || "Not set"}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profileCompletion}%</Text>
          <Text style={styles.statLabel}>Profile complete</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{canDonate ? "ON" : "OFF"}</Text>
          <Text style={styles.statLabel}>Donation status</Text>
        </View>
      </View>

      {!isEditing ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Donation Availability</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Ionicons name={canDonate ? "heart-outline" : "pause-circle-outline"} size={18} color={Colors.light.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>{canDonate ? "Available for donation" : "Currently unavailable"}</Text>
                <Text style={styles.summaryValue}>
                  {canDonate
                    ? "You are visible in donor search and can respond to requests."
                    : "You are hidden from donor search until you turn availability back on."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <InfoRow icon="person-outline" label="Full name" value={name || "Not set"} />
            <InfoRow icon="call-outline" label="Phone" value={phone || "Not set"} />
            <InfoRow icon="water-outline" label="Blood group" value={bloodGroup || "Not set"} />
            <InfoRow icon="male-female-outline" label="Gender" value={gender || "Not set"} />
            <InfoRow icon="location-outline" label="Area" value={area || "Not set"} />
            <InfoRow icon="calendar-outline" label="Date of birth" value={formatDateLabel(dateOfBirth)} />
            <InfoRow icon="medical-outline" label="Last donated" value={formatDateLabel(lastDonated)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Location & Account</Text>
            <InfoRow icon="navigate-outline" label="Saved location" value={locationLabel} />

            <TouchableOpacity style={styles.secondaryBtn} onPress={refreshLocation}>
              <Ionicons name="locate-outline" size={18} color={Colors.light.text} />
              <Text style={styles.secondaryBtnText}>Refresh location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={Colors.light.danger} />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.editHeader}>
            <View>
              <Text style={styles.sectionTitle}>Edit Profile</Text>
              <Text style={styles.sectionHint}>Update your donor information and save when you’re done.</Text>
            </View>
          </View>

          <View style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Donation availability</Text>
              <Text style={styles.toggleHint}>Control whether you appear in donor search results.</Text>
            </View>
            <Switch
              value={canDonate}
              onValueChange={setCanDonate}
              trackColor={{ false: "#d1d5db", true: "#f8b4c3" }}
              thumbColor={canDonate ? Colors.light.tint : "#f9fafb"}
            />
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            placeholder="017xxxxxxxx"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
            keyboardType={Platform.OS === "ios" ? "number-pad" : "phone-pad"}
          />

          <Text style={styles.label}>Area</Text>
          <TextInput
            value={area}
            onChangeText={setArea}
            style={styles.input}
            placeholder="Mirpur, Dhaka"
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
          />

          <View style={styles.inlineInputs}>
            <View style={styles.inlineInputBlock}>
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                maxLength={10}
              />
            </View>
            <View style={styles.inlineInputBlock}>
              <Text style={styles.label}>Last Donated</Text>
              <TextInput
                value={lastDonated}
                onChangeText={setLastDonated}
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                maxLength={10}
              />
            </View>
          </View>

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

          <View style={styles.infoPanel}>
            <View style={styles.infoRowInline}>
              <Ionicons name="navigate-outline" size={16} color={Colors.light.icon} />
              <Text style={styles.infoInlineText}>{locationLabel}</Text>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={refreshLocation}>
              <Ionicons name="locate-outline" size={18} color={Colors.light.text} />
              <Text style={styles.secondaryBtnText}>Refresh location</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEditing}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={save}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save changes"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={18} color={Colors.light.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    backgroundColor: Colors.light.background,
  },
  hero: {
    backgroundColor: "#102a43",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroIdentityCard: {
    borderRadius: 22,
    padding: 16,
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: "#f8d7df",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#020617",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 34,
    fontWeight: "900",
    color: Colors.light.tint,
  },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    borderWidth: 2,
    borderColor: "#102a43",
  },
  heroCopy: {
    gap: 4,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#d9e2ec",
    lineHeight: 19,
  },
  identityGrid: {
    gap: 10,
  },
  identityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  identityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  identityLabel: {
    color: "#d9e2ec",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  identityValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  editBtnText: {
    color: Colors.light.text,
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
  },
  statLabel: {
    marginTop: 4,
    color: Colors.light.icon,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.light.text,
  },
  sectionHint: {
    marginTop: 4,
    color: Colors.light.icon,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fceef3",
  },
  summaryLabel: {
    color: Colors.light.icon,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 20,
  },
  editHeader: {
    marginBottom: 2,
  },
  toggleCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: Colors.light.surface,
  },
  toggleTitle: {
    color: Colors.light.text,
    fontWeight: "800",
    fontSize: 15,
  },
  toggleHint: {
    color: Colors.light.icon,
    marginTop: 4,
    lineHeight: 18,
  },
  label: {
    fontWeight: "700",
    color: Colors.light.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.light.surface,
    color: Colors.light.text,
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInputBlock: {
    flex: 1,
    gap: 8,
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
    borderColor: Colors.light.border,
  },
  chipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  chipText: {
    color: Colors.light.text,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
  },
  infoPanel: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  infoRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoInlineText: {
    color: Colors.light.text,
    fontWeight: "600",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: Colors.light.text,
    fontWeight: "700",
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  cancelBtnText: {
    color: Colors.light.text,
    fontWeight: "800",
  },
  primaryBtn: {
    flex: 1,
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
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutBtnText: {
    color: Colors.light.danger,
    fontWeight: "800",
  },
});
