import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = "4000";

function extractHostFromExpo() {
  const constants = Constants as typeof Constants & {
    manifest2?: unknown;
    manifest?: unknown;
  };

  const manifest = constants.manifest2 as
    | {
        extra?: {
          expoGo?: {
            debuggerHost?: string;
          };
          eas?: {
            projectId?: string;
          };
        };
      }
    | undefined;

  const expoGoHost = manifest?.extra?.expoGo?.debuggerHost;
  if (expoGoHost) {
    return expoGoHost.split(":")[0] ?? null;
  }

  const classicManifest = constants.manifest as { debuggerHost?: string } | null;
  if (classicManifest?.debuggerHost) {
    return classicManifest.debuggerHost.split(":")[0] ?? null;
  }

  return null;
}

export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (Platform.OS === "web") {
    return `http://localhost:${API_PORT}`;
  }

  const expoHost = extractHostFromExpo();
  if (expoHost) {
    return `http://${expoHost}:${API_PORT}`;
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE = getApiBaseUrl();
