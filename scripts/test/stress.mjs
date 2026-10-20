// Live integration test, not a simulator: real MediaStore images, Room, WorkManager and Nextcloud.
// Both device tasks run concurrently after a shared build. Never logs credentials or full commands.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseCredentials } from "./live-credentials.mjs";
import { createStressNetwork } from "./stress-network.mjs";

const root = resolve(import.meta.dirname, "../..");
const APP = "ninja.domi.cloudhoist";
const TEST_APP = "ninja.domi.cloudhoist.engine.test";
const provider = `content://${APP}.account-acceptance`;
const runId = `stress-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const outputDir = join(root, "test-results", runId);
const photoCount = Number(process.env.STRESS_PHOTO_COUNT ?? 2000);
const deadlineMs = Number(process.env.STRESS_TIMEOUT_MINUTES ?? 120) * 60_000;
if (!Number.isFinite(deadlineMs) || deadlineMs <= 0)
  throw new Error("STRESS_TIMEOUT_MINUTES must be a positive number.");
if (!Number.isInteger(photoCount) || photoCount < 2000 || photoCount > 20000)
  throw new Error("STRESS_PHOTO_COUNT must be 2000–20000.");
const credentials = parseCredentials(
  await readFile(join(root, "test-creds.tct"), "utf8"),
);
const secretValues = Object.values(credentials).flatMap((value) => [
  value,
  Buffer.from(value).toString("base64url"),
]);
const redact = (value) =>
  secretValues.reduce(
    (text, secret) => text.replaceAll(secret, "<redacted>"),
    String(value),
  );
const log = (message) =>
  process.stdout.write(`${new Date().toISOString()} ${redact(message)}\n`);
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    log("Interrupted; restoring both targets at the next cleanup checkpoint.");
  });
const checkInterrupted = () => {
  if (interrupted) throw new Error("Stress run interrupted");
};
await mkdir(outputDir, { recursive: true });

async function run(
  command,
  args,
  { timeout = 180_000, allowFailure = false, binary = false, input } = {},
) {
  return await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    const chunks = [];
    const errors = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errors.push(chunk));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`${command} could not start: ${error.code}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !allowFailure) {
        reject(
          new Error(
            `${command} failed (${code ?? "timeout"}): ${redact(Buffer.concat([...chunks, ...errors]).toString()).slice(-5000)}`,
          ),
        );
      } else
        resolveRun(
          binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString(),
        );
    });
  });
}
const adb = (serial, args, options) =>
  run("adb", ["-s", serial, ...args], options);
const auth = `Basic ${Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")}`;
async function request(url, options = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await fetch(url, {
        ...options,
        redirect: "manual",
        headers: { Authorization: auth, ...options.headers },
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      if (attempt === 7)
        throw new Error(
          "The Nextcloud host could not be reached after eight attempts.",
        );
      const retrySeconds = Math.min(30, 2 ** (attempt + 1));
      log(`Nextcloud connection failed; retrying in ${retrySeconds} seconds.`);
      await delay(retrySeconds * 1000);
    }
  }
}
const userResponse = await request(
  `${credentials.serverUrl.replace(/\/$/, "")}/ocs/v2.php/cloud/user?format=json`,
  { headers: { "OCS-APIRequest": "true" } },
);
if (userResponse.status !== 200)
  throw new Error(`Nextcloud preflight returned HTTP ${userResponse.status}`);
const davUser = (await userResponse.json())?.ocs?.data?.id;
if (typeof davUser !== "string" || !davUser)
  throw new Error("Nextcloud preflight omitted account ID.");
secretValues.push(davUser);
const server = new URL(credentials.serverUrl);
const addresses = await lookup(server.hostname, { all: true });
const address =
  addresses.find((item) => item.family === 4)?.address ?? addresses[0]?.address;
if (!address) throw new Error("Nextcloud DNS preflight failed.");
const dav = (parts) =>
  `${credentials.serverUrl.replace(/\/$/, "")}/remote.php/dav/files/${[davUser, ...parts].map(encodeURIComponent).join("/")}`;

let devices = await run("adb", ["devices"]);
if (!/^emulator-\S+\s+device$/m.test(devices)) {
  log("Starting medium_phone emulator…");
  await run("android", ["emulator", "start", "medium_phone"], {
    timeout: 360_000,
  });
  devices = await run("adb", ["devices"]);
}
const serials = devices
  .split(/\r?\n/)
  .filter((line) => /\sdevice$/.test(line))
  .map((line) => line.split(/\s/)[0]);
const phone =
  process.env.STRESS_PHONE_SERIAL ??
  serials.find((serial) => !serial.startsWith("emulator-"));
const emulator =
  process.env.STRESS_EMULATOR_SERIAL ??
  serials.find((serial) => serial.startsWith("emulator-"));
if (
  !phone ||
  !emulator ||
  !serials.includes(phone) ||
  !serials.includes(emulator) ||
  phone === emulator
)
  throw new Error(
    "Stress testing requires an authorized phone AND emulator. Check adb devices.",
  );

log(
  `Building bundled stress APK and separate fixture harness for ${phone} and ${emulator}…`,
);
const build = await run(
  "./android/gradlew",
  [
    "-p",
    "android",
    "-I",
    "../scripts/test/stress.init.gradle",
    ":app:assembleStress",
    ":app:assembleRelease",
    ":webdav-upload-engine:assembleDebugAndroidTest",
  ],
  { timeout: 1_200_000 },
);
await writeFile(join(outputDir, "build.log"), redact(build));
const apk = join(root, "android/app/build/outputs/apk/stress/app-stress.apk");
const releaseApk = join(
  root,
  "android/app/build/outputs/apk/release/app-release.apk",
);
const testApk = join(
  root,
  "modules/webdav-upload-engine/android/build/outputs/apk/androidTest/debug/webdav-upload-engine-debug-androidTest.apk",
);
await Promise.all([apk, releaseApk, testApk].map((path) => access(path)));
const samples = [];
log("Downloading varied photo samples from Lorem Picsum…");
for (let index = 0; index < 6; index++) {
  const response = await fetch(
    `https://picsum.photos/seed/${runId}-${index}/960/720.jpg`,
    { signal: AbortSignal.timeout(90_000) },
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || bytes[0] !== 0xff || bytes[1] !== 0xd8)
    throw new Error("Photo sample download failed.");
  const path = join(outputDir, `sample-${index}.jpg`);
  await writeFile(path, bytes);
  samples.push(path);
}

async function instrument(serial, runFolder, method) {
  const result = await adb(
    serial,
    [
      "shell",
      "am",
      "instrument",
      "-w",
      "-r",
      "-e",
      "class",
      `ninja.domi.cloudhoist.engine.LiveStressTest#${method}`,
      "-e",
      "stressRun",
      runFolder,
      "-e",
      "photoCount",
      String(photoCount),
      "-e",
      "stressEmulator",
      String(serial === emulator),
      `${TEST_APP}/androidx.test.runner.AndroidJUnitRunner`,
    ],
    { timeout: method === "seedPhotos" ? 900_000 : 600_000 },
  );
  await writeFile(
    join(outputDir, `${serial}-${method}-${Date.now()}.log`),
    redact(result),
  );
  if (!result.includes("OK (1 test)"))
    throw new Error(
      `${serial}: ${method} failed. ${redact(result).slice(-3000)}`,
    );
}
async function call(serial, method, runFolder, extras = []) {
  const output = await adb(
    serial,
    [
      "shell",
      "content",
      "call",
      "--uri",
      provider,
      "--method",
      method,
      "--arg",
      runFolder,
      ...extras,
    ],
    { timeout: 240_000 },
  );
  if (!output.includes("status=ok"))
    throw new Error(`${serial}: ${method} failed: ${redact(output)}`);
  const counts = Object.fromEntries(
    [
      ...output.matchAll(/(queued|running|completed|retrying|blocked)=(\d+)/g),
    ].map((match) => [match[1], Number(match[2])]),
  );
  return {
    ...counts,
    errors: output.match(/errors=([^,}\]]*)/)?.[1] ?? "",
    workerFailed: output.includes("workerFailed=true"),
  };
}

async function readBackgroundStatus(serial, runFolder) {
  const path = `/sdcard/Android/data/${APP}/files/stress-status-${runFolder}.json`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const output = await adb(serial, ["exec-out", "cat", path], {
      allowFailure: true,
    });
    if (!output.trim()) {
      await delay(1000);
      continue;
    }
    const snapshot = JSON.parse(output);
    if (snapshot.monitorError)
      throw new Error(`${serial}: passive status monitor failed (${snapshot.monitorError})`);
    if (
      snapshot.status !== "ok" ||
      typeof snapshot.workerFailed !== "boolean" ||
      !["queued", "running", "completed", "retrying", "blocked"].every(
        (key) => Number.isInteger(snapshot[key]) && snapshot[key] >= 0,
      )
    )
      throw new Error(`${serial}: invalid passive status snapshot`);
    return snapshot;
  }
  throw new Error(`${serial}: passive status snapshot is missing`);
}
const extra = (key, value) => [
  "--extra",
  `${key}:s:${Buffer.from(value).toString("base64url")}`,
];
async function launch(serial, route = "/") {
  await adb(serial, [
    "shell",
    "am",
    "start",
    "-W",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    `cloud-hoist://${route}`,
    "-p",
    APP,
  ]);
}
async function screenshot(serial, label) {
  const bytes = await adb(serial, ["exec-out", "screencap", "-p"], {
    binary: true,
  });
  await writeFile(join(outputDir, `${serial}-${label}.png`), bytes);
}
async function uiScreenshots(serial, runFolder, label) {
  for (const screen of [
    "backup-editor",
    "screenshots-editor",
    "edit-backup",
    "remote-picker",
    "account-settings",
    "backups",
    "activity",
    "settings",
  ]) {
    const bytes = await adb(
      serial,
      [
        "exec-out",
        "run-as",
        TEST_APP,
        "cat",
        `files/${runFolder}/${label}-${screen}.png`,
      ],
      { binary: true },
    );
    await writeFile(join(outputDir, `${serial}-${label}-${screen}.png`), bytes);
  }
}

async function testDevice(serial, isEmulator) {
  const runFolder = `${runId}-${isEmulator ? "emu" : "phone"}`;
  const result = {
    serial,
    runFolder,
    photoCount,
    startedAt: new Date().toISOString(),
    checkpoints: [],
  };
  const oldFont = (
    await adb(serial, ["shell", "settings", "get", "system", "font_scale"])
  ).trim();
  const oldProxy = (
    await adb(serial, ["shell", "settings", "get", "global", "http_proxy"])
  ).trim();
  const oldNight = isEmulator
    ? (await adb(serial, ["shell", "cmd", "uimode", "night"])).match(
        /Night mode: (\w+)/,
      )?.[1]
    : undefined;
  const oldHardwareKeyboard = (
    await adb(serial, [
      "shell",
      "settings",
      "get",
      "secure",
      "show_ime_with_hard_keyboard",
    ])
  ).trim();
  const oldPower = isEmulator
    ? await adb(serial, ["emu", "power", "display"])
    : undefined;
  const oldAc = oldPower?.match(/^AC: (online|offline)/m)?.[1];
  const oldBatteryStatus = oldPower
    ?.match(/^status: (.+)/m)?.[1]
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");
  if (
    isEmulator &&
    (!oldAc ||
      !["unknown", "charging", "discharging", "not-charging", "full"].includes(
        oldBatteryStatus,
      ))
  )
    throw new Error("Cannot capture emulator power state for restoration.");
  let network;
  let powerChanged = false;
  let chargingRecoveryStarted = false;
  let seeded = false;
  let installed = false;
  let reinstallStarted = false;
  let remoteCreated = false;
  let failure;
  let lastStats;
  const deviceStartedAt = (
    await adb(serial, ["shell", "date", "+%Y-%m-%dT%H:%M:%S"])
  ).trim();
  try {
    checkInterrupted();
    await adb(serial, ["install", "-r", testApk], { timeout: 300_000 });
    const samplePath = `files/${runFolder}`;
    await adb(serial, ["shell", "run-as", TEST_APP, "mkdir", "-p", samplePath]);
    for (const [index, sample] of samples.entries()) {
      await adb(
        serial,
        [
          "shell",
          "run-as",
          TEST_APP,
          "sh",
          "-c",
          `'cat > ${samplePath}/sample-${index}.jpg'`,
        ],
        { input: await readFile(sample) },
      );
    }
    seeded = true;
    log(
      `${serial}: creating ${photoCount} photos before reinstall. Samsung may take several minutes.`,
    );
    await instrument(serial, runFolder, "seedPhotos");
    checkInterrupted();
    log(`${serial}: photos indexed; clean reinstalling ${APP}.`);
    reinstallStarted = true;
    await adb(serial, ["uninstall", APP], { allowFailure: true });
    await adb(serial, ["install", apk], { timeout: 300_000 });
    installed = true;
    for (const permission of [
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "POST_NOTIFICATIONS",
    ])
      await adb(serial, [
        "shell",
        "pm",
        "grant",
        APP,
        `android.permission.${permission}`,
      ]);
    await instrument(serial, runFolder, "freshInstallUi");
    await screenshot(serial, "fresh-install");
    checkInterrupted();
    if (isEmulator) {
      network = await createStressNetwork(
        server.hostname,
        address,
        Number(server.port || 443),
      );
      await adb(serial, [
        "reverse",
        `tcp:${network.port}`,
        `tcp:${network.port}`,
      ]);
      await adb(serial, [
        "shell",
        "settings",
        "put",
        "global",
        "http_proxy",
        `127.0.0.1:${network.port}`,
      ]);
      log(
        `${serial}: HTTPS tunnel limited to 96 KiB/s per direction, 750 ms connection latency.`,
      );
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await call(serial, "connect", runFolder, [
          ...extra("serverUrlB64", credentials.serverUrl),
          ...extra("usernameB64", credentials.username),
          ...extra("appPasswordB64", credentials.appPassword),
          ...extra("serverAddressB64", address),
        ]);
        break;
      } catch (error) {
        if (
          attempt === 5 ||
          !/NETWORK|TIMEOUT|CONNECTION_REFUSED|DNS|SERVER/.test(error.message)
        )
          throw error;
        log(`${serial}: initial account connection interrupted; retrying.`);
        await delay(5000);
      }
    }
    checkInterrupted();
    const absent = await request(dav([runFolder]), {
      method: "PROPFIND",
      headers: { Depth: "0" },
    });
    if (absent.status !== 404)
      throw new Error(
        "The isolated remote fixture path must not already exist.",
      );
    // From here, even a lost MKCOL response can leave a run-owned directory to clean up.
    remoteCreated = true;
    const created = await request(dav([runFolder]), { method: "MKCOL" });
    if (![201, 405].includes(created.status))
      throw new Error(
        `Remote test directory creation returned ${created.status}`,
      );
    await instrument(serial, runFolder, "grantAccess");
    lastStats = await call(serial, "stressStatus", runFolder);
    if (lastStats.queued !== photoCount)
      throw new Error(
        `${serial}: discovered ${lastStats.queued}, expected ${photoCount}`,
      );
    result.checkpoints.push({ phase: "discovered", ...lastStats });
    await adb(serial, [
      "shell",
      "settings",
      "put",
      "secure",
      "show_ime_with_hard_keyboard",
      "1",
    ]);
    await launch(serial);
    log(
      `${serial}: ${photoCount} real uploads queued; checking UI during background transfers.`,
    );
    await instrument(serial, runFolder, "exerciseUnderLoad");
    checkInterrupted();
    for (const variant of isEmulator
      ? ["normal", "large-text", "dark"]
      : ["normal", "large-text"])
      await uiScreenshots(serial, runFolder, variant);
    if (network) {
      if (network.stats.bytes === 0)
        throw new Error("Emulator traffic bypassed the degraded network.");
      log(`${serial}: interrupting the active HTTPS network for 15 seconds.`);
      network.setOffline(true);
      await delay(15_000);
      network.setOffline(false);
    }
    log(
      `${serial}: killing the app process and cold-starting to check durable queue recovery.`,
    );
    await adb(serial, ["shell", "am", "force-stop", APP]);
    await launch(serial);
    await call(serial, "stressResume", runFolder);
    if (isEmulator) {
      powerChanged = true;
      await adb(serial, ["emu", "power", "ac", "off"]);
      await adb(serial, ["emu", "power", "status", "discharging"]);
      result.checkpoints.push({
        phase: "on-battery",
        at: new Date().toISOString(),
      });
    }
    await adb(serial, ["shell", "input", "keyevent", "KEYCODE_HOME"]);
    log(
      `${serial}: checking the remaining uploads with the app in the background.`,
    );
    const backgroundStartedAt = Date.now();
    const deadline = backgroundStartedAt + deadlineMs;
    while (Date.now() < deadline) {
      checkInterrupted();
      // Exercise Android's real battery/job limits, then ordinary plugged-in recovery.
      // Do not force jobs, unrestrict the app, or disable Android's quota enforcement.
      if (
        isEmulator &&
        !chargingRecoveryStarted &&
        Date.now() - backgroundStartedAt >= 25 * 60_000
      ) {
        await adb(serial, ["emu", "power", "ac", "on"]);
        await adb(serial, ["emu", "power", "status", "charging"]);
        chargingRecoveryStarted = true;
        result.checkpoints.push({
          phase: "plugged-in",
          at: new Date().toISOString(),
        });
        log(
          `${serial}: 25 minutes on battery completed; testing plugged-in background recovery with the same slow network.`,
        );
      }
      lastStats = await readBackgroundStatus(serial, runFolder);
      result.checkpoints.push({ at: new Date().toISOString(), ...lastStats });
      log(
        `${serial}: ${lastStats.completed}/${photoCount} uploaded, ${lastStats.queued} queued, ${lastStats.retrying} retrying, ${lastStats.blocked} blocked.`,
      );
      const total = [
        "completed",
        "queued",
        "retrying",
        "running",
        "blocked",
      ].reduce((sum, key) => sum + lastStats[key], 0);
      if (total !== photoCount)
        throw new Error(
          `${serial}: queue lost or duplicated files (${total}/${photoCount})`,
        );
      if (lastStats.blocked)
        throw new Error(`${serial}: uploads are blocked (${lastStats.errors})`);
      if (lastStats.workerFailed)
        throw new Error(
          `${serial}: the upload worker failed with unfinished uploads`,
        );
      if (lastStats.completed === photoCount) break;
      await delay(20_000);
    }
    if (lastStats.completed !== photoCount)
      throw new Error(`${serial}: upload deadline expired`);
    const listing = await request(dav([runFolder]), {
      method: "PROPFIND",
      headers: { Depth: "1", "Content-Type": "application/xml" },
      body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/></d:prop></d:propfind>',
    });
    if (listing.status !== 207)
      throw new Error("Remote inventory verification failed.");
    const xml = await listing.text();
    const remoteNames = [
      ...xml.matchAll(
        /<(?:[\w.-]+:)?href\b[^>]*>([^<]*)<\/(?:[\w.-]+:)?href>/g,
      ),
    ]
      .map((match) => decodeURIComponent(match[1]).split("/").pop())
      .filter((name) => name && name !== runFolder);
    const names = new Set(remoteNames);
    const expected = new RegExp(`^${runFolder}-\\d{5}\\.jpg$`);
    const unexpected = remoteNames.filter((name) => !expected.test(name));
    if (names.size !== photoCount || unexpected.length)
      throw new Error(
        `${serial}: Nextcloud contains ${names.size}/${photoCount} files, including ${unexpected.length} unexpected/staging objects`,
      );
    for (const index of [0, Math.floor(photoCount / 2), photoCount - 1]) {
      const name = `${runFolder}-${String(index).padStart(5, "0")}.jpg`;
      const local = await adb(
        serial,
        [
          "exec-out",
          "cat",
          `/sdcard/${index % 2 === 0 ? "DCIM/Camera" : "Pictures/Screenshots"}/${name}`,
        ],
        { binary: true },
      );
      const response = await request(dav([runFolder, name]));
      if (response.status !== 200)
        throw new Error("Uploaded sample cannot be downloaded.");
      const remote = Buffer.from(await response.arrayBuffer());
      if (
        createHash("sha256").update(local).digest("hex") !==
        createHash("sha256").update(remote).digest("hex")
      )
        throw new Error("Uploaded sample differs from the phone photo.");
    }
    const exits = await adb(serial, [
      "shell",
      "dumpsys",
      "activity",
      "exit-info",
      APP,
    ]);
    const crashes = exits.split(/ApplicationExitInfo/).filter(
      (entry) =>
        /reason=\d+ \((CRASH|CRASH_NATIVE|ANR)\)/.test(entry) &&
        (entry
          .match(/timestamp=([\d-]+) ([\d:.]+)/)
          ?.slice(1)
          .join("T") ?? "") >= deviceStartedAt,
    );
    await writeFile(join(outputDir, `${serial}-exit-info.txt`), redact(exits));
    if (crashes.length)
      throw new Error(
        `${serial}: Android recorded a crash or ANR; inspect exit-info report`,
      );
    result.remoteFiles = names.size;
    result.hashesVerified = 3;
    result.network = network?.stats;
    result.passed = true;
    log(
      `${serial}: PASS, ${photoCount} remote files, three byte-identical samples, no crash/ANR.`,
    );
  } catch (error) {
    failure = error;
    result.passed = false;
    result.error = redact(error.message);
    log(`${serial}: FAIL: ${result.error}`);
    await screenshot(serial, "failure").catch(() => {});
  } finally {
    result.network = network?.stats;
    const cleanupErrors = [];
    const cleanup = async (label, fn) => {
      try {
        await fn();
      } catch (error) {
        cleanupErrors.push(`${label}: ${redact(error.message)}`);
      }
    };
    if (installed)
      await cleanup("remove test backup", () =>
        call(serial, "stressCleanup", runFolder),
      );
    if (seeded)
      await cleanup("remove generated photos", () =>
        instrument(serial, runFolder, "cleanupPhotos"),
      );
    if (network) {
      await cleanup("restore proxy", async () => {
        // Deleting http_proxy alone leaves Android's parsed host/port active.
        await adb(serial, [
          "shell",
          "settings",
          "put",
          "global",
          "http_proxy",
          oldProxy === "null" ? ":0" : oldProxy,
        ]);
        if (oldProxy === "null")
          await adb(serial, [
            "shell",
            "settings",
            "delete",
            "global",
            "http_proxy",
          ]);
      });
      await cleanup("remove proxy tunnel", () =>
        adb(serial, ["reverse", "--remove", `tcp:${network.port}`]),
      );
      await network.close();
    }
    await cleanup("restore font scale", () =>
      oldFont === "null"
        ? adb(serial, ["shell", "settings", "delete", "system", "font_scale"])
        : adb(serial, [
            "shell",
            "settings",
            "put",
            "system",
            "font_scale",
            oldFont,
          ]),
    );
    await cleanup("restore hardware-keyboard preference", () =>
      oldHardwareKeyboard === "null"
        ? adb(serial, [
            "shell",
            "settings",
            "delete",
            "secure",
            "show_ime_with_hard_keyboard",
          ])
        : adb(serial, [
            "shell",
            "settings",
            "put",
            "secure",
            "show_ime_with_hard_keyboard",
            oldHardwareKeyboard,
          ]),
    );
    if (oldNight)
      await cleanup("restore night mode", () =>
        adb(serial, ["shell", "cmd", "uimode", "night", oldNight]),
      );
    if (powerChanged)
      await cleanup("restore emulator power", async () => {
        await adb(serial, [
          "emu",
          "power",
          "ac",
          oldAc === "online" ? "on" : "off",
        ]);
        await adb(serial, ["emu", "power", "status", oldBatteryStatus]);
      });
    if (remoteCreated)
      await cleanup("remove remote test folder", async () => {
        const response = await request(dav([runFolder]), { method: "DELETE" });
        if (![204, 404].includes(response.status))
          throw new Error(`HTTP ${response.status}`);
      });
    if (reinstallStarted)
      await cleanup("restore normal app build", async () => {
        await adb(serial, ["install", "-r", releaseApk], { timeout: 300_000 });
        await launch(serial);
      });
    result.finishedAt = new Date().toISOString();
    result.cleanupErrors = cleanupErrors;
    if (cleanupErrors.length) {
      result.passed = false;
      failure ??= new Error(cleanupErrors.join("; "));
    }
    await writeFile(
      join(outputDir, `${serial}-result.json`),
      JSON.stringify(result, null, 2),
    );
  }
  if (failure) throw failure;
  return result;
}

log(`Running phone and emulator concurrently. Reports: ${outputDir}`);
const results = await Promise.allSettled([
  testDevice(phone, false),
  testDevice(emulator, true),
]);
for (const result of results)
  if (result.status === "rejected")
    log(`FAIL: ${redact(result.reason.message)}`);
if (results.some((result) => result.status === "rejected"))
  process.exitCode = 1;
else
  log(
    "Parallel live stress test passed on both targets. Generated fixtures removed; normal app restored.",
  );
