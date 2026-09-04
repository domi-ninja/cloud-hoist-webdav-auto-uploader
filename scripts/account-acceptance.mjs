import { readFileSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const credentialPath = join(projectRoot, "test-creds.tct");

function stripQuotes(value) {
  const trimmed = String(value).trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizedKey(value) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function parseCredentials(contents) {
  const values = {};

  function fieldForKey(key) {
    const normalized = normalizedKey(key);
    if (/(apppassword|password|passwd|pass|apptoken|token|secret|pwd|pw)$/.test(normalized)) {
      return "appPassword";
    }
    if (/(username|userid|user|loginname|login)$/.test(normalized)) {
      return "username";
    }
    if (/(serverurl|nextcloudurl|baseurl|server|url|host)$/.test(normalized)) {
      return "serverUrl";
    }
    return undefined;
  }

  function collectJson(value, parentKey = "") {
    if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "string")) {
      [values.serverUrl, values.username, values.appPassword] = value.map(stripQuotes);
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const field = fieldForKey(`${parentKey}${key}`);
      if (field && typeof child === "string") {
        values[field] = stripQuotes(child);
      } else {
        collectJson(child, `${parentKey}${key}`);
      }
    }
  }

  try {
    collectJson(JSON.parse(contents));
  } catch {
    // The local file may use dotenv-style fields instead of JSON.
  }

  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const positional = [];
  for (const line of lines) {
    const match = /^-?\s*([A-Za-z][A-Za-z0-9_. -]*)\s*[=:]\s*(.*)$/.exec(line);
    if (!match) {
      positional.push(stripQuotes(line));
      continue;
    }
    const field = fieldForKey(match[1]);
    if (field) {
      values[field] = stripQuotes(match[2]);
    } else {
      positional.push(stripQuotes(line));
    }
  }

  if (!values.serverUrl) {
    const serverIndex = positional.findIndex((value) => /^https:\/\//i.test(value));
    if (serverIndex >= 0) {
      values.serverUrl = positional.splice(serverIndex, 1)[0];
    }
  }
  for (const field of ["serverUrl", "username", "appPassword"]) {
    if (!values[field] && positional.length) {
      values[field] = positional.shift();
    }
  }

  if (!values.serverUrl && lines.length === 1) {
    const parts = lines[0].split(/[\t;, ]+/).map(stripQuotes).filter(Boolean);
    if (parts.length === 3) {
      [values.serverUrl, values.username, values.appPassword] = parts;
    }
  }

  const credentials = {
    serverUrl:
      typeof values.serverUrl === "string" && !values.serverUrl.includes("://")
        ? `https://${values.serverUrl}`
        : values.serverUrl,
    username: values.username,
    appPassword: values.appPassword,
  };
  if (
    Object.values(credentials).some(
      (value) => typeof value !== "string" || !value || /[\r\n\0]/.test(value),
    )
  ) {
    throw new Error(
      "test-creds.tct must contain serverUrl, username, and appPassword fields.",
    );
  }
  try {
    const parsedServerUrl = new URL(credentials.serverUrl);
    if (parsedServerUrl.protocol !== "https:" || !parsedServerUrl.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error("test-creds.tct must identify a valid HTTPS server.");
  }
  return credentials;
}

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
await verifyCredentialsFromHost(credentials);
const serverAddresses = await lookup(new URL(credentials.serverUrl).hostname, { all: true });
const serverAddress =
  serverAddresses.find(({ family }) => family === 4)?.address ?? serverAddresses[0]?.address;
if (!serverAddress) {
  throw new Error("The development host could not resolve the Nextcloud server.");
}
const deviceOutput = run("adb", ["devices"]);
const serial = deviceOutput
  .split("\n")
  .map((line) => line.split(/\s+/))
  .find(([candidate, state]) => candidate?.startsWith("emulator-") && state === "device")?.[0];
if (!serial) {
  throw new Error("Start the configured Android emulator before the live account test.");
}

process.stdout.write("Building the app and debug-only account acceptance test…\n");
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
const encodedArguments = {
  serverUrlB64: Buffer.from(credentials.serverUrl).toString("base64url"),
  usernameB64: Buffer.from(credentials.username).toString("base64url"),
  appPasswordB64: Buffer.from(credentials.appPassword).toString("base64url"),
  serverAddressB64: Buffer.from(serverAddress).toString("base64url"),
  launchUrlB64: Buffer.from(launchUrl).toString("base64url"),
};

process.stdout.write("Running manual login, process-death, and encrypted-reload checks…\n");
run("adb", ["-s", serial, "shell", "pm", "clear", "ninja.domi.webdavautoupload"], {
  stdio: "ignore",
});
const redactionValues = [
  credentials.serverUrl,
  credentials.username,
  credentials.appPassword,
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

metro?.kill("SIGINT");
process.stdout.write("Live account acceptance passed; no credential values were printed.\n");
