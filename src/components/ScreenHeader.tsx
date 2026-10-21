import { Text, View } from "react-native";
import type { AccountHealth } from "../../modules/webdav-upload-engine";
import { AccountConnection } from "@/features/account/AccountConnection";

export function ScreenHeader({ title, account }: { title: string; account?: AccountHealth }) {
  return <View className="min-h-12 flex-row items-center justify-between gap-2 mb-2">
    <Text accessibilityRole="header" className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">{title}</Text>
    {account?.status === "connected" ? <AccountConnection account={account} /> : null}
  </View>;
}
