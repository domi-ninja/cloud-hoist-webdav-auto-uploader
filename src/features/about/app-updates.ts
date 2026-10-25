import { z } from "zod";

import { project } from "@/config/project";

const fdroidPackageSchema = z.object({
  packageName: z.literal(project.androidPackage),
  suggestedVersionCode: z.number().int().positive(),
  packages: z.array(z.object({
    versionName: z.string().trim().min(1),
    versionCode: z.number().int().positive(),
  })).nonempty(),
});

export type UpdateChannel = "beta" | "fdroid";

export function updateChannel(value: unknown): UpdateChannel {
  return value === "fdroid" ? "fdroid" : "beta";
}

const githubRepository = "domi-ninja/cloud-hoist-webdav-auto-uploader";
const githubReleasesSchema = z.array(z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  assets: z.array(z.object({
    name: z.string(), state: z.string(), size: z.number(), browser_download_url: z.string(),
  })),
}));

function githubUpdate(body: unknown, installedVersionCode: number) {
  const parsed = githubReleasesSchema.safeParse(body);
  if (!parsed.success) throw new Error("Update check failed: GitHub returned invalid release information.");
  const candidates = parsed.data.flatMap((release) => {
    // F-Droid reference APKs have a different channel. Never offer them to beta users.
    const match = /^(?:beta-|v)(20\d{2})-([1-9]\d{0,3})$/.exec(release.tag_name);
    if (release.draft || !match) return [];
    const version = `${match[1]}-${match[2]}`;
    const name = `cloud-hoist-${version}.apk`;
    const url = `https://github.com/${githubRepository}/releases/download/${release.tag_name}/${name}`;
    const asset = release.assets.find((item) => item.name === name && item.state === "uploaded" && item.size > 0 && item.browser_download_url === url);
    return asset ? [{ version, versionCode: Number(match[1]) * 10000 + Number(match[2]), url }] : [];
  });
  if (!candidates.length) throw new Error("Update check failed: GitHub has no published beta APKs.");
  const latest = candidates.reduce((a, b) => a.versionCode > b.versionCode ? a : b);
  return latest.versionCode > installedVersionCode
    ? { status: "available" as const, version: latest.version, url: latest.url }
    : { status: "up-to-date" as const };
}

export async function checkAppUpdates(installedVersionCode: number, channel: UpdateChannel = "beta") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const provider = channel === "beta" ? "GitHub" : "F-Droid";
    const response = await fetch(
      channel === "beta" ? `https://api.github.com/repos/${githubRepository}/releases?per_page=100`
        : `https://f-droid.org/api/v1/packages/${project.androidPackage}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (channel === "fdroid" && response.status === 404) {
      throw new Error("Update check failed: Cloud Hoist is not listed on F-Droid yet.");
    }
    if (!response.ok) {
      throw new Error(`Update check failed: ${provider} returned HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    if (channel === "beta") return githubUpdate(body, installedVersionCode);
    const parsed = fdroidPackageSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error("Update check failed: F-Droid returned invalid version information.");
    }
    const { packages, suggestedVersionCode } = parsed.data;
    // The suggested version may not have built yet. Only offer published packages.
    const latest = packages.find((item) => item.versionCode === suggestedVersionCode)
      ?? packages.reduce((a, b) => a.versionCode > b.versionCode ? a : b);
    return latest.versionCode > installedVersionCode
      ? { status: "available" as const, version: latest.versionName, url: `https://f-droid.org/packages/${project.androidPackage}/` }
      : { status: "up-to-date" as const };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Update check failed:")) throw error;
    throw new Error(controller.signal.aborted
      ? "Update check failed: the request timed out."
      : `Update check failed: ${channel === "beta" ? "GitHub" : "F-Droid"} could not be reached or its response could not be read.`);
  } finally {
    clearTimeout(timeout);
  }
}
