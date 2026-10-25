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

export async function checkAppUpdates(installedVersionCode: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://f-droid.org/api/v1/packages/${project.androidPackage}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (response.status === 404) {
      throw new Error("Update check failed: Cloud Hoist is not listed on F-Droid yet.");
    }
    if (!response.ok) {
      throw new Error(`Update check failed: F-Droid returned HTTP ${response.status}.`);
    }
    const parsed = fdroidPackageSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("Update check failed: F-Droid returned invalid version information.");
    }
    const { packages, suggestedVersionCode } = parsed.data;
    // The suggested version may not have built yet. Only offer published packages.
    const latest = packages.find((item) => item.versionCode === suggestedVersionCode)
      ?? packages.reduce((a, b) => a.versionCode > b.versionCode ? a : b);
    return latest.versionCode > installedVersionCode
      ? { status: "available" as const, version: latest.versionName }
      : { status: "up-to-date" as const };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Update check failed:")) throw error;
    throw new Error(controller.signal.aborted
      ? "Update check failed: the request timed out."
      : "Update check failed: F-Droid could not be reached or its response could not be read.");
  } finally {
    clearTimeout(timeout);
  }
}
