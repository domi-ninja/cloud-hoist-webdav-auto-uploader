export function formatRemoteRoot(path: string[]) {
  return path.length ? `/${path.join("/")}` : "/";
}
