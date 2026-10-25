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
  const blocker = attentionBlockers(snapshot.blockers).find((item) => item.kind !== "job");
  if (blocker) {
    switch (blocker.kind) {
      case "account":
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

// Native queue totals include only enabled sources; failed files still count as unfinished.
export function uploadProgress(snapshot: EngineSnapshot) {
  const { queued, uploading, failed, uploaded } = snapshot.queue;
  const total = queued + uploading + failed + uploaded;
  return { uploaded, total, fraction: total === 0 ? 0 : uploaded / total };
}

/** Only quote a completion time while the entire queue can make progress. */
export function uploadRemainingTime(snapshot: EngineSnapshot) {
  if (snapshot.engine.state !== "running" || snapshot.worker.state !== "uploading" ||
      snapshot.queue.failed > 0 || snapshot.blockers.length > 0) return null;
  const seconds = snapshot.queue.estimatedRemainingSeconds;
  if (seconds == null) return "Estimating…";
  if (seconds < 60) return "<1 min left";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `~${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `~${hours} hr${remainder ? ` ${remainder} min` : ""} left`;
}


// Worker identity is authoritative; stale recent jobs must not look active.
export function activeUpload(snapshot: EngineSnapshot) {
  const worker = snapshot.worker;
  if (snapshot.engine.state !== "running" || worker.state !== "uploading") return undefined;
  return snapshot.recentJobs.find((job) => job.id === worker.jobId);
}

export function activeSourceFirst(snapshot: EngineSnapshot) {
  const sourceId = activeUpload(snapshot)?.sourceId;
  return sourceId
    ? [...snapshot.sources].sort((a, b) => Number(b.id === sourceId) - Number(a.id === sourceId))
    : snapshot.sources;
}
