// Drives the live Nextcloud acceptance flow invoked by `pnpm test:account:live`.
// It validates local credentials, builds and installs debug APKs, clears the selected target's
// app data, verifies direct and chunked uploads, and removes its local and remote fixtures.

import { readFileSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCredentials } from "./live-credentials.mjs";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const credentialPath = join(projectRoot, "test-creds.tct");
const resolveDeviceScript = join(projectRoot, "scripts", "android", "resolve-device.sh");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed.`);
  }
  return result.stdout ?? "";
}

function findApk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findApk(path);
      if (found) return found;
    } else if (entry.name.endsWith(".apk")) {
      return path;
    }
  }
  return undefined;
}

async function verifyCredentialsFromHost(credentials) {
  const endpoint = `${credentials.serverUrl.replace(/\/+$/, "")}/ocs/v2.php/cloud/user?format=json`;
  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${credentials.username}:${credentials.appPassword}`,
        ).toString("base64")}`,
        "OCS-APIRequest": "true",
      },
      redirect: "manual",
    });
  } catch {
    throw new Error("The development host could not reach the Nextcloud server.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("The Nextcloud server rejected the credentials in test-creds.tct.");
  }
  if (response.status !== 200) {
    throw new Error(`The Nextcloud host preflight returned HTTP ${response.status}.`);
  }
  const body = await response.json().catch(() => undefined);
  const davUserId = body?.ocs?.data?.id;
  if (typeof davUserId !== "string" || !davUserId || /[\r\n\0]/.test(davUserId)) {
    throw new Error("The Nextcloud user preflight returned an invalid account ID.");
  }
  return { davUserId };
}

async function metroIsReady() {
  try {
    const response = await fetch("http://127.0.0.1:8081/status");
    return (await response.text()).includes("packager-status:running");
  } catch {
    return false;
  }
}

async function waitForMetro() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await metroIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Metro did not become ready.");
}

const credentials = parseCredentials(readFileSync(credentialPath, "utf8"));
const hostAccount = await verifyCredentialsFromHost(credentials);
const serverAddresses = await lookup(new URL(credentials.serverUrl).hostname, { all: true });
const serverAddress =
  serverAddresses.find(({ family }) => family === 4)?.address ?? serverAddresses[0]?.address;
if (!serverAddress) {
  throw new Error("The development host could not resolve the Nextcloud server.");
}
const serial = run(resolveDeviceScript, process.argv.slice(2)).trim();

process.stdout.write(`Building the app and debug-only account acceptance test for ${serial}…\n`);
run(
  join(projectRoot, "android", "gradlew"),
  [":app:assembleDebug", ":webdav-upload-engine:assembleDebugAndroidTest"],
  { cwd: join(projectRoot, "android"), stdio: "ignore" },
);

const appApk = join(projectRoot, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const testApk = findApk(
  join(projectRoot, "modules", "webdav-upload-engine", "android", "build", "outputs", "apk", "androidTest"),
);
if (!testApk) {
  throw new Error("The debug-only account acceptance APK was not produced.");
}

run("adb", ["-s", serial, "install", "-r", appApk], { stdio: "ignore" });
run("adb", ["-s", serial, "install", "-r", testApk], { stdio: "ignore" });
run("adb", ["-s", serial, "reverse", "tcp:8081", "tcp:8081"], { stdio: "ignore" });

let metro;
if (!(await metroIsReady())) {
  metro = spawn("pnpm", ["exec", "expo", "start", "--dev-client", "--localhost"], {
    cwd: projectRoot,
    env: { ...process.env, CI: "1", EXPO_UNSTABLE_HEADLESS: "1" },
    stdio: "ignore",
  });
  await waitForMetro();
}

const launchUrl =
  "exp+webdav-auto-upload://expo-development-client/?url=" +
  encodeURIComponent("http://127.0.0.1:8081");
const runFolder = `webdav-auto-upload-acceptance-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const encodedArguments = {
  serverUrlB64: Buffer.from(credentials.serverUrl).toString("base64url"),
  usernameB64: Buffer.from(credentials.username).toString("base64url"),
  appPasswordB64: Buffer.from(credentials.appPassword).toString("base64url"),
  serverAddressB64: Buffer.from(serverAddress).toString("base64url"),
  launchUrlB64: Buffer.from(launchUrl).toString("base64url"),
  runFolderB64: Buffer.from(runFolder).toString("base64url"),
};

process.stdout.write("Running manual login, process-death, and encrypted-reload checks…\n");
run("adb", ["-s", serial, "shell", "pm", "clear", "ninja.domi.webdavautoupload"], {
  stdio: "ignore",
});
const redactionValues = [
  credentials.serverUrl,
  credentials.username,
  credentials.appPassword,
  hostAccount.davUserId,
  serverAddress,
  ...Object.values(encodedArguments),
];
const component =
  "ninja.domi.webdavautoupload.engine.test/androidx.test.runner.AndroidJUnitRunner";

function redact(output) {
  return redactionValues.reduce(
    (redacted, value) => redacted.replaceAll(value, "<redacted>"),
    output,
  );
}

function runProvider(method, extras = []) {
  const result = run("adb", [
    "-s",
    serial,
    "shell",
    "content",
    "call",
    "--uri",
    "content://ninja.domi.webdavautoupload.account-acceptance",
    "--method",
    method,
    ...extras,
  ]);
  const safeResult = redact(result);
  if (!safeResult.includes("status=ok")) {
    process.stderr.write(safeResult);
    throw new Error(`The debug account ${method} check failed.`);
  }
  return safeResult;
}

function providerValue(output, key) {
  const match = new RegExp(`(?:\\[|\\{|,|\\s)${key}=([^,}\\]]+)`).exec(output);
  if (!match) throw new Error(`The debug upload result omitted ${key}.`);
  return match[1].trim();
}

function providerNetworkArguments() {
  return [
    "--extra",
    `serverUrlB64:s:${encodedArguments.serverUrlB64}`,
    "--extra",
    `serverAddressB64:s:${encodedArguments.serverAddressB64}`,
    "--extra",
    `runFolderB64:s:${encodedArguments.runFolderB64}`,
  ];
}

function davUrl(pathSegments, directory = false) {
  const base = new URL(
    credentials.serverUrl.endsWith("/") ? credentials.serverUrl : `${credentials.serverUrl}/`,
  );
  const encodedPath = [
    "remote.php",
    "dav",
    "files",
    hostAccount.davUserId,
    ...pathSegments,
  ]
    .map(encodeURIComponent)
    .join("/");
  return new URL(`${encodedPath}${directory ? "/" : ""}`, base);
}

function authorizationHeader() {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")}`;
}

async function verifyRemoteFile(name, expectedSha256) {
  const response = await fetch(davUrl([runFolder, name]), {
    headers: { Authorization: authorizationHeader() },
  });
  if (response.status !== 200) {
    throw new Error(`Remote fixture verification returned HTTP ${response.status}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error("An uploaded fixture was not byte-identical to the target's media.");
  }
}

async function deleteRemoteRunDirectory() {
  const response = await fetch(davUrl([runFolder], true), {
    method: "DELETE",
    headers: { Authorization: authorizationHeader() },
  });
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`Remote acceptance cleanup returned HTTP ${response.status}.`);
  }
}

function runInstrumentation(testName, argumentsList) {
  const result = run("adb", [
    "-s",
    serial,
    "shell",
    "am",
    "instrument",
    "-w",
    "-r",
    "-e",
    "class",
    `ninja.domi.webdavautoupload.engine.LiveAccountAcceptanceTest#${testName}`,
    ...argumentsList,
    component,
  ]);
  const redacted = redact(result);
  if (!redacted.includes("OK (1 test)")) {
    process.stderr.write(redacted);
    throw new Error("The live account acceptance test failed.");
  }
}

let remoteCreated = false;
let failure;
try {
  runProvider("connect", [
    "--extra",
    `serverUrlB64:s:${encodedArguments.serverUrlB64}`,
    "--extra",
    `usernameB64:s:${encodedArguments.usernameB64}`,
    "--extra",
    `appPasswordB64:s:${encodedArguments.appPasswordB64}`,
    "--extra",
    `serverAddressB64:s:${encodedArguments.serverAddressB64}`,
  ]);
  run("adb", ["-s", serial, "shell", "am", "force-stop", "ninja.domi.webdavautoupload"], {
    stdio: "ignore",
  });
  run("adb", [
    "-s",
    serial,
    "shell",
    "am",
    "start",
    "-W",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    launchUrl,
    "-p",
    "ninja.domi.webdavautoupload",
  ], { stdio: "ignore" });
  runProvider("verify", [
    "--extra",
    `serverUrlB64:s:${encodedArguments.serverUrlB64}`,
    "--extra",
    `serverAddressB64:s:${encodedArguments.serverAddressB64}`,
  ]);
  runInstrumentation("connectedAccountRendersAfterProcessDeath", [
    "-e",
    "launchUrlB64",
    encodedArguments.launchUrlB64,
  ]);

  process.stdout.write("Creating target images and running direct and chunked upload checks…\n");
  run("adb", [
    "-s",
    serial,
    "shell",
    "pm",
    "grant",
    "ninja.domi.webdavautoupload",
    "android.permission.READ_MEDIA_IMAGES",
  ], { stdio: "ignore" });
  run("adb", [
    "-s",
    serial,
    "shell",
    "pm",
    "grant",
    "ninja.domi.webdavautoupload",
    "android.permission.READ_MEDIA_VIDEO",
  ], { stdio: "ignore" });
  runProvider("prepareUpload", providerNetworkArguments());
  remoteCreated = true;
  const uploadOutput = runProvider("seedAndUpload", providerNetworkArguments());
  const smallName = providerValue(uploadOutput, "smallName");
  const largeName = providerValue(uploadOutput, "largeName");
  const smallSha256 = providerValue(uploadOutput, "smallSha256");
  const largeSha256 = providerValue(uploadOutput, "largeSha256");
  const completedJobs = Number(providerValue(uploadOutput, "completedJobs"));
  const directUploads = Number(providerValue(uploadOutput, "directUploads"));
  const chunkedUploads = Number(providerValue(uploadOutput, "chunkedUploads"));
  const chunkingExpected = providerValue(uploadOutput, "chunkingExpected") === "true";
  if (
    completedJobs !== 2 ||
    directUploads + chunkedUploads !== 2 ||
    chunkedUploads !== (chunkingExpected ? 1 : 0)
  ) {
    throw new Error("The live queue returned an invalid upload summary.");
  }
  await Promise.all([
    verifyRemoteFile(smallName, smallSha256),
    verifyRemoteFile(largeName, largeSha256),
  ]);
  run("adb", ["-s", serial, "shell", "am", "force-stop", "ninja.domi.webdavautoupload"], {
    stdio: "ignore",
  });
  runInstrumentation("completedUploadsRenderAfterProcessDeath", [
    "-e",
    "launchUrlB64",
    encodedArguments.launchUrlB64,
  ]);
  process.stdout.write(
    `Verified 2 byte-identical uploads from target media (${directUploads} direct, ${chunkedUploads} chunked).\n`,
  );
} catch (error) {
  failure = error;
}

try {
  runProvider("cleanupMedia", providerNetworkArguments());
} catch (error) {
  failure ??= error;
}
if (remoteCreated) {
  try {
    await deleteRemoteRunDirectory();
  } catch {
    failure ??= new Error(`Remote cleanup failed for acceptance run ${runFolder}.`);
  }
}
metro?.kill("SIGINT");
if (failure) throw failure;
process.stdout.write(
  "Live account and upload acceptance passed; local and remote fixtures were removed.\n",
);
