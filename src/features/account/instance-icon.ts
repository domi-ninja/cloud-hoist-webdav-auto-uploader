export function nextcloudInstanceIconUrl(serverUrl: string) {
  return `${serverUrl.replace(/\/$/, "")}/index.php/apps/theming/icon`;
}

export function nextcloudInstanceLabel(serverUrl: string) {
  const url = new URL(serverUrl);
  const subpath = url.pathname.replace(/\/$/, "");
  return `${url.host}${subpath}`;
}
