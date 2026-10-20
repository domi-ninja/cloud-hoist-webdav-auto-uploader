import { beforeEach, expect, it, jest } from "@jest/globals";
import { Alert } from "react-native";
import webDavUploadEngine from "../../../modules/webdav-upload-engine";
import { requestBackupNotifications } from "./backup-notifications";

jest.mock("../../../modules/webdav-upload-engine", () => ({
  __esModule: true,
  default: { getNotificationPermission: jest.fn(), requestNotificationPermission: jest.fn() },
}));
const getPermission = jest.mocked(webDavUploadEngine.getNotificationPermission);
const requestPermission = jest.mocked(webDavUploadEngine.requestNotificationPermission);
const alert = jest.spyOn(Alert, "alert");
beforeEach(() => {
  jest.clearAllMocks();
  getPermission.mockResolvedValue({ ok: true, value: { granted: false, canAskAgain: true } });
});
it("waits for Continue before requesting Android permission", async () => {
  const result = requestBackupNotifications();
  await Promise.resolve();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(requestPermission).not.toHaveBeenCalled();
  alert.mock.calls[0][2]?.find((button) => button.text === "Continue")?.onPress?.();
  await result;
  expect(requestPermission).toHaveBeenCalledTimes(1);
});
it("keeps Not now free of an OS permission request", async () => {
  const result = requestBackupNotifications();
  await Promise.resolve();
  alert.mock.calls[0][2]?.find((button) => button.text === "Not now")?.onPress?.();
  await result;
  expect(requestPermission).not.toHaveBeenCalled();
});
it.each([{ granted: true, canAskAgain: false }, { granted: false, canAskAgain: false }])("skips unnecessary prompts: %j", async (value) => {
  getPermission.mockResolvedValue({ ok: true, value });
  await requestBackupNotifications();
  expect(alert).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
});
