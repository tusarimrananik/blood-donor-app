import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { API_BASE } from "@/constants/api";

const AUTH_STORAGE_KEY = "AUTH_SESSION_V1";
const REQUEST_TIMEOUT_MS = 45000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lastDonated: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profileImage: string | null;
  canDonate: boolean;
  lat: number;
  lon: number;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, unknown>) => Promise<void>;
  refreshMe: () => Promise<void>;
  updateProfile: (payload: Record<string, unknown>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
  authFetch: typeof fetch;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function saveSession(session: AuthSession | null) {
  if (!session) {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

async function loadSession() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out while contacting ${API_BASE}. The server may be cold-starting or unreachable.`);
    }
    throw new Error(`Could not reach ${API_BASE}. Check your connection and reload the app.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function getProjectId() {
  const constantsAny = Constants as typeof Constants & {
    easConfig?: { projectId?: string | null } | null;
    expoConfig?: { extra?: { eas?: { projectId?: string | null } } } | null;
    manifest2?: { extra?: { eas?: { projectId?: string | null } } } | null;
    appOwnership?: string | null;
  };

  return (
    constantsAny.easConfig?.projectId ??
    constantsAny.expoConfig?.extra?.eas?.projectId ??
    constantsAny.manifest2?.extra?.eas?.projectId ??
    null
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setToken(session.token);
        setUser(session.user);
      }
      setReady(true);
    })();
  }, []);

  const persistSession = async (session: AuthSession | null) => {
    setToken(session?.token ?? null);
    setUser(session?.user ?? null);
    await saveSession(session);
  };

  const authFetch: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return fetchWithTimeout(input, {
      ...init,
      headers,
    });
  };

  useEffect(() => {
    if (!token) return;

    let alive = true;

    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("bloodlink-alerts", {
            name: "BloodLink alerts",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 150, 250],
            lightColor: "#8b1e3f",
          });
        }

        const constantsAny = Constants as typeof Constants & { appOwnership?: string | null };
        if (Platform.OS === "android" && constantsAny.appOwnership === "expo") {
          return;
        }

        const permission = await Notifications.getPermissionsAsync();
        let status = permission.status;
        if (status !== "granted") {
          const nextPermission = await Notifications.requestPermissionsAsync();
          status = nextPermission.status;
        }

        if (status !== "granted" || !alive) return;

        const projectId = getProjectId();
        if (!projectId) return;

        const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!alive) return;

        await authFetch(`${API_BASE}/notifications/register-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: pushToken.data,
            platform: Platform.OS,
          }),
        });
      } catch (error) {
        console.log("Push registration skipped:", error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    await persistSession({ token: json.token as string, user: json.user as AuthUser });
  };

  const register = async (payload: Record<string, unknown>) => {
    const res = await fetchWithTimeout(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const fieldErrors = json?.errors?.fieldErrors;
      if (fieldErrors && typeof fieldErrors === "object") {
        const lines: string[] = [];
        for (const key of Object.keys(fieldErrors)) {
          const value = fieldErrors[key];
          if (Array.isArray(value) && value.length) {
            lines.push(`${key}: ${value.join(", ")}`);
          }
        }
        if (lines.length) {
          throw new Error(lines.join("\n"));
        }
      }
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    await persistSession({ token: json.token as string, user: json.user as AuthUser });
  };

  const refreshMe = async () => {
    if (!token) return;

    const res = await authFetch(`${API_BASE}/auth/me`);
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      await persistSession(null);
      return;
    }

    await persistSession({ token, user: json.user as AuthUser });
  };

  const updateProfile = async (payload: Record<string, unknown>) => {
    const res = await authFetch(`${API_BASE}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const fieldErrors = json?.errors?.fieldErrors;
      if (fieldErrors && typeof fieldErrors === "object") {
        const lines: string[] = [];
        for (const key of Object.keys(fieldErrors)) {
          const value = fieldErrors[key];
          if (Array.isArray(value) && value.length) {
            lines.push(`${key}: ${value.join(", ")}`);
          }
        }
        if (lines.length) {
          throw new Error(lines.join("\n"));
        }
      }
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    await persistSession({ token: token!, user: json.user as AuthUser });
  };

  const deleteAccount = async () => {
    const res = await authFetch(`${API_BASE}/auth/me`, {
      method: "DELETE",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || `HTTP ${res.status}`);
    }

    await persistSession(null);
  };

  const logout = async () => {
    await persistSession(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      refreshMe,
      updateProfile,
      deleteAccount,
      logout,
      authFetch,
    }),
    [ready, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
