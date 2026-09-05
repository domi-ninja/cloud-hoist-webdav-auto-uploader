import type {
  AccountSummary,
  ManualAccountInput,
} from "../../../modules/webdav-upload-engine";

export type AccountSettingsValue = ManualAccountInput;

export function initialAccountSettings(account: AccountSummary): AccountSettingsValue {
  return {
    serverUrl: account.serverUrl,
    username: account.username,
    appPassword: "",
  };
}

export function accountSettingsChanged(
  account: AccountSummary,
  value: AccountSettingsValue,
) {
  return (
    value.serverUrl.trim() !== account.serverUrl ||
    value.username.trim() !== account.username ||
    value.appPassword.length > 0
  );
}

export function canSaveAccountSettings(
  account: AccountSummary,
  value: AccountSettingsValue,
) {
  return (
    accountSettingsChanged(account, value) &&
    Boolean(value.serverUrl.trim() && value.username.trim() && value.appPassword)
  );
}
