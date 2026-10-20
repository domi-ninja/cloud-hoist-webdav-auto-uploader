import { z } from "zod";

import app from "../../../app.json";
import distribution from "../../../release.config.json";

export const updateConfig = {
  ...distribution,
  appName: app.expo.name,
  androidPackage: app.expo.android.package,
};

export const releasesUrl = `https://github.com/${updateConfig.githubRepository}/releases/latest`;
export const updateManifestUrl = `${releasesUrl}/download/update.json`;

const releaseSchema = z.object({
  schemaVersion: z.literal(1),
  appName: z.string().min(1),
  androidPackage: z.string().min(1),
  version: z.string().min(1),
  versionCode: z.number().int().positive(),
  apkUrl: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type AppRelease = z.infer<typeof releaseSchema>;

/** Ignore older builds, and reject downloads for another package or repository. */
export function availableUpdate(
  payload: unknown,
  installedBuild: number,
  config = updateConfig,
): AppRelease | null {
  const release = releaseSchema.parse(payload);
  const apk = new URL(release.apkUrl);
  if (
    release.androidPackage !== config.androidPackage ||
    apk.origin !== "https://github.com" ||
    apk.username || apk.password || apk.search || apk.hash ||
    !apk.pathname.startsWith(`/${config.githubRepository}/releases/download/`) ||
    !apk.pathname.endsWith(".apk")
  ) {
    throw new Error("The update does not match this app's release configuration.");
  }
  return release.versionCode > installedBuild ? release : null;
}

export async function fetchAvailableUpdate(installedBuild: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(updateManifestUrl, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Could not check for updates.");
    return availableUpdate(await response.json(), installedBuild);
  } finally {
    clearTimeout(timeout);
  }
}

/** Store builds prefer the installed Google Play app; other devices get the signed APK. */
export async function openAppUpdate(
  release: AppRelease,
  config: Pick<typeof updateConfig, "appIsInStore" | "androidPackage">,
  handlers: {
    openPlayStore: (androidPackage: string) => Promise<boolean>;
    openUrl: (url: string) => Promise<unknown>;
  },
) {
  if (config.appIsInStore) {
    const opened = await handlers.openPlayStore(config.androidPackage).catch(() => false);
    if (opened) return "play-store";
  }
  await handlers.openUrl(release.apkUrl);
  return "apk";
}
