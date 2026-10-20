import type { EngineSnapshot } from "../../modules/webdav-upload-engine";
import { formatRelativeTime } from "./format";

// Waiting for transfer rules or an automatic retry does not require user action.
export function attentionBlockers(blockers: EngineSnapshot["blockers"]) {
  return blockers.filter((blocker) => blocker.kind !== "network");
}

export function engineStatus(snapshot: EngineSnapshot, now: number) {
  if (snapshot.engine.state === "paused") {
    return snapshot.worker.state === "uploading"
      ? "Uploads paused by you · stopping the current upload"
      : "Uploads paused by you";
  }
  if (snapshot.account.status === "error") return snapshot.account.message;
  if (snapshot.account.status !== "connected") return "Connect an account to begin";
  if (snapshot.worker.state === "scanning") return "Scanning for new files";
  if (snapshot.worker.state === "uploading") return "Uploading";
  if (snapshot.worker.state === "waiting" || snapshot.worker.state === "stopped") {
    return snapshot.worker.reason;
  }
  const blocker = attentionBlockers(snapshot.blockers)[0];
  if (blocker) {
    switch (blocker.kind) {
      case "account":
      case "job":
        return blocker.message;
      case "permission": {
        const source = snapshot.sources.find(
          (source) => source.id === blocker.sourceId,
        );
        return `Restore ${blocker.permission === "media" ? "photo" : "folder"} access${source ? ` for ${source.name}` : ""}`;
      }
      case "storage":
        return "Not enough storage on your phone";
    }
  }
  if (!snapshot.sources.length) return "Choose a folder to start uploading";
  if (snapshot.sources.every((source) => !source.enabled)) {
    return "All backup folders are disabled";
  }
  if (snapshot.queue.failed) {
    return `${snapshot.queue.failed} ${snapshot.queue.failed === 1 ? "file could" : "files could"} not be uploaded`;
  }
  if (snapshot.queue.queued) return "Uploads have not started";
  if (snapshot.queue.uploaded) return "All files uploaded";
  if (snapshot.scheduler.lastScanCompletedAt) {
    return `Last scan ${formatRelativeTime(snapshot.scheduler.lastScanCompletedAt, now)}`;
  }
  return "Ready to upload";
}

// Include disabled folders and failed files: unfinished backups must not read as complete.
export function uploadProgress(snapshot: EngineSnapshot) {
  const { queued, uploading, failed, uploaded } = snapshot.queue;
  const total = queued + uploading + failed + uploaded;
  return { uploaded, total, fraction: total === 0 ? 0 : uploaded / total };
}
