import { describe, expect, it } from "@jest/globals";

import type { AccountSummary } from "../../../modules/webdav-upload-engine";
import {
  accountSettingsChanged,
  canSaveAccountSettings,
  initialAccountSettings,
} from "./account-settings-state";

const account: AccountSummary = {
  id: "3fd9c8c2-7d27-4c63-a672-4fb8793582fa",
  serverUrl: "https://cloud.example.test",
  username: "domi",
  davUserId: "domi",
  displayName: "Domi",
  checkedAt: "2026-09-05T12:00:00.000Z",
  capabilities: {
    serverVersion: "34",
    chunkingSupported: true,
    maxChunkSize: null,
  },
};

describe("account settings state", () => {
  it("hydrates public fields without hydrating the secret", () => {
    expect(initialAccountSettings(account)).toEqual({
      serverUrl: account.serverUrl,
      username: account.username,
      appPassword: "",
    });
  });

  it("requires a fresh app password before saving a replacement", () => {
    const initial = initialAccountSettings(account);
    expect(accountSettingsChanged(account, initial)).toBe(false);
    expect(
      canSaveAccountSettings(account, {
        ...initial,
        serverUrl: "https://new.example.test",
      }),
    ).toBe(false);
    expect(
      canSaveAccountSettings(account, {
        ...initial,
        serverUrl: "https://new.example.test",
        appPassword: "secret",
      }),
    ).toBe(true);
  });
});
