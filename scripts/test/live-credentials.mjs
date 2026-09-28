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

export function parseCredentials(contents) {
  const values = {};

  function fieldForKey(key) {
    const normalized = normalizedKey(key);
    if (
      /(apppassword|password|passwd|pass|apptoken|token|secret|pwd|pw)$/.test(
        normalized,
      )
    ) {
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
    if (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every((item) => typeof item === "string")
    ) {
      [values.serverUrl, values.username, values.appPassword] =
        value.map(stripQuotes);
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
    const serverIndex = positional.findIndex((value) =>
      /^https:\/\//i.test(value),
    );
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
    const parts = lines[0]
      .split(/[\t;, ]+/)
      .map(stripQuotes)
      .filter(Boolean);
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
