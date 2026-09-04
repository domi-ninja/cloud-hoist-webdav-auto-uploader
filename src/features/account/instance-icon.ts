export function nextcloudInstanceIconUrl(serverUrl: string) {
  return `${serverUrl.replace(/\/$/, "")}/index.php/apps/theming/icon`;
}
