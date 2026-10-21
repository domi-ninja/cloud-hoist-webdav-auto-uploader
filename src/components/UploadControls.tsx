import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import webDavUploadEngine, { type EngineSnapshot } from "../../modules/webdav-upload-engine";
import { ActionButton, Panel } from "./ui";
import { UploadProgress } from "./UploadProgress";
import { useEngineSnapshot } from "@/lib/engine-query";

/** One set of upload controls shared by Backups and Status. */
export function UploadControls({ snapshot, now, onError, onScanned }: {
  snapshot: EngineSnapshot;
  now: number;
  onError: (message: string | undefined) => void;
  onScanned?: () => Promise<unknown>;
}) {
  const router = useRouter();
  const { refetch } = useEngineSnapshot();
  const [scanning, setScanning] = useState(false);
  const [pausing, setPausing] = useState(false);
  const paused = snapshot.engine.state === "paused";
  const stopped = snapshot.worker.state === "stopped";
  const connected = snapshot.account.status === "connected" && snapshot.sources.length > 0;
  const scan = async () => {
    setScanning(true);
    onError(undefined);
    try {
      const result = await webDavUploadEngine.scanNow();
      if (!result.ok) onError(result.error.message);
      await Promise.all([refetch(), onScanned?.()]);
    } catch { onError("Could not scan backup folders. Please try again."); }
    finally { setScanning(false); }
  };
  const toggle = async () => {
    setPausing(true);
    onError(undefined);
    try {
      const result = paused || stopped ? await webDavUploadEngine.resume() : await webDavUploadEngine.pause();
      if (!result.ok) onError(result.error.message);
      await refetch();
    } catch { onError("Could not change backup state. Please try again."); }
    finally { setPausing(false); }
  };
  return (
    <Panel>
      <UploadProgress snapshot={snapshot} now={now} onRescan={connected ? () => void scan() : undefined} scanning={scanning} />
      {connected ? <View className="flex-row flex-wrap items-center gap-2">
        <ActionButton icon={paused || stopped ? "play" : "pause"} disabled={pausing} loading={pausing}
          label={paused ? "Resume uploads" : stopped ? "Start uploads" : "Pause uploads"} onPress={() => void toggle()} />
        {snapshot.blockers.length ? <ActionButton label={`${snapshot.blockers.length} ${snapshot.blockers.length === 1 ? "issue" : "issues"}`}
          tone="danger" onPress={() => router.navigate("/status")} /> : null}
      </View> : null}
    </Panel>
  );
}
