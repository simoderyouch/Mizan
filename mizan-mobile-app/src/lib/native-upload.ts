import { Platform } from "react-native";

export type NativeUploadPayload = {
  uri: string;
  name: string;
  type: string;
};

export function resolveNativeUploadPayload(file: NativeUploadPayload) {
  let uri = file.uri.trim();
  if (
    Platform.OS === "android" &&
    !uri.startsWith("file://") &&
    !uri.startsWith("content://")
  ) {
    uri = `file://${uri}`;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const type =
    file.type ||
    (ext === "m4a" || ext === "mp4" || ext === "aac"
      ? "audio/mp4"
      : ext === "caf"
        ? "audio/x-caf"
        : ext === "wav"
          ? "audio/wav"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "png"
              ? "image/png"
              : "application/octet-stream");

  return { uri, name: file.name, type };
}

export async function waitForRecordingUri(getUri: () => string | null, attempts = 12) {
  for (let i = 0; i < attempts; i += 1) {
    const uri = getUri()?.trim();
    if (uri) return uri;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return getUri()?.trim() ?? null;
}
