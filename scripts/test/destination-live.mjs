// Uses the installed engine test APK, isolated Room, and a UUID-owned remote root.
// ANDROID_SERIAL=<phone> node scripts/test/destination-live.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseCredentials } from "./live-credentials.mjs";

const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error("Set ANDROID_SERIAL to the physical phone to test.");
const credentials = parseCredentials(readFileSync("test-creds.tct", "utf8"));
const encoded = Buffer.from(JSON.stringify(credentials)).toString("base64url");
const result = spawnSync("adb", ["-s", serial, "shell", "am", "instrument", "-w", "-r",
  "-e", "class", "ninja.domi.cloudhoist.engine.DestinationChangeLiveTest",
  "-e", "destinationCredentialsB64", encoded,
  "ninja.domi.cloudhoist.engine.test/androidx.test.runner.AndroidJUnitRunner"],
  { encoding: "utf8", timeout: 180_000 });
let output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
for (const secret of [encoded, ...Object.values(credentials)]) output = output.replaceAll(secret, "<redacted>");
process.stdout.write(output);
if (result.error || result.status !== 0 || !/OK \(1 test\)/.test(output)) process.exitCode = 1;
