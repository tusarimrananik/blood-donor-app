// app/donor/[id].tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// 🔸 Keep this mock list in-sync with app/(tabs)/index.tsx for now.
// Later: you will fetch this from backend by id.
const MOCK_DONORS = [
    {
        id: "1",
        name: "Rahim",
        phone: "01711111111",
        bloodGroup: "A+",
        area: "Dhanmondi",
        lat: 23.7465,
        lon: 90.376,
        availableNow: true,
        lastDonated: "2025-08-01",
        eligible: true,
    },
    {
        id: "2",
        name: "Karim",
        phone: "01822222222",
        bloodGroup: "O+",
        area: "Mohammadpur",
        lat: 23.7644,
        lon: 90.3586,
        availableNow: false,
        lastDonated: "2025-11-20",
        eligible: false,
    },
    {
        id: "3",
        name: "Sadia",
        phone: "01933333333",
        bloodGroup: "B-",
        area: "Mirpur",
        lat: 23.8069,
        lon: 90.3687,
        availableNow: true,
        lastDonated: "",
        eligible: true,
    },
];

export default function DonorDetailsScreen() {
    const router = useRouter();
    const { id, distance, lat, lon, eligible, daysLeft, nextEligibleDate } =
        useLocalSearchParams<{
            id?: string;
            distance?: string;
            lat?: string;
            lon?: string;
            eligible?: string;
            daysLeft?: string;
            nextEligibleDate?: string;
        }>();

    const distanceText =
        distance && distance.length > 0 && !Number.isNaN(Number(distance))
            ? `${Number(distance).toFixed(2)} km`
            : "Unknown";
    const eligibleBool = eligible === "true";
    const eligibilityText = eligibleBool
        ? "✅ Eligible"
        : `⏳ Eligible in ${Number(daysLeft || "0")} days (${nextEligibleDate || "Unknown"})`;
    const donor = useMemo(() => {
        if (!id) return null;
        return MOCK_DONORS.find((d) => d.id === String(id)) ?? null;
    }, [id]);

    const handleRequest = () => {
        if (!donor) return;
        Alert.alert(
            "Request Sent (Demo)",
            `Request sent to ${donor.name} (${donor.bloodGroup}).\n\nLater we’ll save this in backend.`
        );
    };

    const handleDirections = async () => {
        if (!lat || !lon) {
            Alert.alert("No location", "This donor has no coordinates (demo).");
            return;
        }

        const destination = `${lat},${lon}`;

        // Works well on web + phones:
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
            Alert.alert("Cannot open Maps", "Could not open Google Maps.");
            return;
        }
        Linking.openURL(url);
    };

    const handleCall = async () => {
        if (!donor) return;
        const url = `tel:${donor.phone}`;

        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
            Alert.alert("Cannot call", "Your device cannot place calls from here.");
            return;
        }
        Linking.openURL(url);
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: "Donor Details",
                    headerBackTitle: "Back",
                }}
            />

            <ScrollView contentContainerStyle={styles.container}>
                {!donor ? (
                    <View style={styles.card}>
                        <Text style={styles.title}>Donor not found</Text>
                        <Text style={styles.text}>No donor exists for id: {String(id ?? "")}</Text>

                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
                            <Text style={styles.secondaryBtnText}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.name}>{donor.name}</Text>

                            <View style={styles.badgeRow}>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>🩸 {donor.bloodGroup}</Text>
                                </View>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>📍 {donor.area}</Text>
                                </View>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>📏 {distanceText}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <InfoRow label="Available now" value={donor.availableNow ? "Yes" : "No"} />
                            <InfoRow label="Eligible" value={eligibilityText } />
                            <InfoRow label="Last donation" value={donor.lastDonated ? donor.lastDonated : "Not provided"} />
                            <InfoRow label="Phone" value={donor.phone} />
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.primaryBtn} onPress={handleRequest}>
                                <Text style={styles.primaryBtnText}>Request (Demo)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                                <Text style={styles.callBtnText}>Call (Demo)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryBtn} onPress={handleDirections}>
                                <Text style={styles.secondaryBtnText}>Directions (Google Maps)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
                                <Text style={styles.secondaryBtnText}>Back</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>
        </>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        gap: 12,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: "#eee",
    },
    name: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 6,
    },
    text: {
        fontSize: 14,
        opacity: 0.8,
        marginBottom: 12,
    },
    badgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    badge: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "#f5f5f5",
    },
    badgeText: {
        fontSize: 13,
        fontWeight: "600",
    },
    divider: {
        height: 1,
        backgroundColor: "#eee",
        marginVertical: 14,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
    },
    rowLabel: {
        fontSize: 14,
        opacity: 0.7,
    },
    rowValue: {
        fontSize: 14,
        fontWeight: "600",
    },
    actions: {
        gap: 10,
    },
    primaryBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "#111827",
    },
    primaryBtnText: {
        color: "#fff",
        fontWeight: "700",
    },
    callBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "#16a34a",
    },
    callBtnText: {
        color: "#fff",
        fontWeight: "700",
    },
    secondaryBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: "#f3f4f6",
    },
    secondaryBtnText: {
        color: "#111827",
        fontWeight: "700",
    },
});
