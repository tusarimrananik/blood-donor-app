import AsyncStorage from "@react-native-async-storage/async-storage";

export type StoredDonor = {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lat: number;
  lon: number;
  availableNow: boolean;
  lastDonated: string;
  createdAt: string;
};

const KEY = "DONORS_V1";

export async function loadDonors(): Promise<StoredDonor[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredDonor[];
  } catch {
    return [];
  }
}

export async function saveDonors(donors: StoredDonor[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(donors));
}

export async function addDonor(donor: StoredDonor) {
  const current = await loadDonors();
  const next = [donor, ...current];
  await saveDonors(next);
  return next;
}

export async function clearDonors() {
  await AsyncStorage.removeItem(KEY);
}
