import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { formatBytes, formatRelativeTime } from "./format";

// Waiting for transfer rules or an automatic retry does not require user action.
export function attentionBlockers(blockers: EngineSnapshot["blockers"]) {
  return blockers.filter((blocker) => blocker.kind !== "network");
}

export function engineStatus(snapshot: EngineSnapshot, now: number) {
  if (snapshot.account.status !== "connected") return "Connect an account to begin";
  if (snapshot.engine.state === "paused") {
    return snapshot.worker.state === "uploading"
      ? "Uploads paused · finishing the current file"
      : `Uploads paused ${formatRelativeTime(snapshot.engine.pausedAt, now)}`;
  }
  if (snapshot.worker.state === "scanning") return "Scanning for new files";
  if (snapshot.worker.state === "uploading") {
    return `Uploading ${formatBytes(snapshot.worker.bytesSent)} of ${formatBytes(snapshot.worker.totalBytes)}`;
  }
  if (snapshot.worker.state === "waiting") return snapshot.worker.reason;
  if (attentionBlockers(snapshot.blockers).length) return "Uploads need attention";
  if (!snapshot.sources.length) return "Choose a folder to start uploading";
  if (snapshot.queue.queued) return "Waiting for Android to start uploads";
  if (snapshot.scheduler.lastScanCompletedAt) {
    return `Last scan ${formatRelativeTime(snapshot.scheduler.lastScanCompletedAt, now)}`;
  }
  return "Ready to upload";
}

export function queueSummary(snapshot: EngineSnapshot) {
  const counts = [
    [snapshot.queue.queued, "queued"],
    [snapshot.queue.uploading, "uploading"],
    [snapshot.queue.failed, "blocked"],
    [snapshot.queue.uploaded, "uploaded"],
  ] as const;
  const active = counts.filter(([count]) => count > 0);
  return active.length
    ? active.map(([count, label]) => `${count} ${label}`).join(" · ")
    : "No uploads yet";
}
