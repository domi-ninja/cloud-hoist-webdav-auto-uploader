import { useState } from "react";
import { Pressable } from "react-native";

import type { AccountSummary } from "../../../modules/webdav-upload-engine";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { InstanceIcon } from "./InstanceIcon";

export function ConnectedAccountButton({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={`Open account settings for ${account.displayName}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-12 min-w-12 items-center justify-center p-2"
        onPress={() => setOpen(true)}
      >
        <InstanceIcon compact serverUrl={account.serverUrl} />
      </Pressable>
      {open ? (
        <AccountSettingsModal
          account={account}
          onClose={() => setOpen(false)}
          onSignedOut={() => setOpen(false)}
          visible
        />
      ) : null}
    </>
  );
}
