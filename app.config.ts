import type { ConfigContext, ExpoConfig } from "expo/config";

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const channel = process.env.CLOUD_HOIST_CHANNEL ?? "beta";
  if (channel !== "beta" && channel !== "fdroid") {
    throw new Error("CLOUD_HOIST_CHANNEL must be beta or fdroid.");
  }
  return { ...config, name: config.name!, slug: config.slug!, extra: { ...config.extra, updateChannel: channel } };
}
