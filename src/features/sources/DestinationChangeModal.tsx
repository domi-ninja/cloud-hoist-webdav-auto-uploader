import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { ProgressBar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import webDavUploadEngine, { type DestinationChange, type DestinationChangeRequest } from "../../../modules/webdav-upload-engine";
import { ActionButton, IconAction, Panel } from "@/components/ui";
import { useAppPreferences } from "@/lib/app-preferences";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  request?: DestinationChangeRequest;
  pending?: DestinationChange;
  onClose: () => void;
  onCompleted: (completed: DestinationChange) => void;
};

/** Used inside the editor's native modal as well as Settings. The journal survives dismissal/process death. */
export function DestinationChangeModal({ request, pending, onClose, onCompleted }: Props) {
  const [change, setChange] = useState(pending);
  const [preview, setPreview] = useState<DestinationChange>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { refreshRemoteRoot } = useAppPreferences();
  const client = useQueryClient();

  useEffect(function loadDestinationPlan() {
    if (!request || pending) return;
    let active = true;
    async function load() {
      const existing = await webDavUploadEngine.getDestinationChange();
      if (!active) return;
      if (!existing.ok) { setError(existing.error.message); return; }
      if (existing.value) { setChange(existing.value); return; }
      const result = await webDavUploadEngine.previewDestinationChange(request!);
      if (!active) return;
      if (result.ok) setPreview(result.value);
      else setError(result.error.message);
    }
    void load();
    return () => { active = false; };
  }, [request, pending]);

  const changeId = change?.id;
  useEffect(function pollMoveProgress() {
    if (!changeId || !busy) return;
    let active = true;
    const timer = setInterval(() => {
      void webDavUploadEngine.getDestinationChange().then((result) => {
        if (active && result.ok && result.value) setChange(result.value);
      });
    }, 400);
    return () => { active = false; clearInterval(timer); };
  }, [changeId, busy]);

  const finish = async (completed: DestinationChange) => {
    await refreshRemoteRoot();
    const acknowledged = await webDavUploadEngine.acknowledgeDestinationChange(completed.id);
    if (!acknowledged.ok) throw new Error(acknowledged.error.message);
    await client.invalidateQueries({ queryKey: ["engine"] });
    onCompleted(completed);
  };

  const run = async (mode: "move" | "copy") => {
    setBusy(true); setError(undefined);
    try {
      let current = change;
      if (!current) {
        if (!request) throw new Error("The destination change is unavailable.");
        const result = await webDavUploadEngine.beginDestinationChange(request, mode);
        if (!result.ok) throw new Error(result.error.message);
        current = result.value;
        setChange(current);
      }
      if (current.state === "completed") { await finish(current); return; }
      const result = await webDavUploadEngine.runDestinationChange(current.id, mode === "copy");
      if (!result.ok) throw new Error(result.error.message);
      setChange(result.value);
      if (result.value.state === "completed") await finish(result.value);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The destination change could not finish.");
    } finally { setBusy(false); }
  };
  const plan = change ?? preview;
  return (
    <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <SafeAreaView className="flex-1 bg-canvas-light dark:bg-canvas-dark">
        <View className="flex-row items-center gap-2 p-2">
          <IconAction icon="close" label="Close destination change" disabled={busy} onPress={onClose} />
          <Text className="flex-1 text-base font-semibold text-ink-light dark:text-ink-dark">
            {change ? "Changing backup destination" : "Change backup destination?"}
          </Text>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-2 p-2">
          {plan?.routes.map((route) => (
            <Panel compact key={route.sourceId}>
              <Text className="text-base font-semibold text-ink-light dark:text-ink-dark">{route.name}</Text>
              <Text className="text-base text-muted-light dark:text-muted-dark">/{route.from.join("/")}</Text>
              <Text className="text-base text-ink-light dark:text-ink-dark">→ /{route.to.join("/")}</Text>
              {plan.errorSourceId === route.sourceId && plan.errorFile ? (
                <Text className="text-base text-red-700 dark:text-red-300">{plan.errorFile}{"\n"}{plan.message}</Text>
              ) : null}
            </Panel>
          ))}
          {!change ? <Text className="text-base text-ink-light dark:text-ink-dark">
            Move existing backups to this destination, or keep them and upload new copies.
          </Text> : null}

        </ScrollView>
        <View className="gap-2 p-2">
          {plan ? <Text className="text-base text-muted-light dark:text-muted-dark">
            {change ? `${plan.processed}/${plan.total} files processed` : `${plan.total} known files to check`}
          </Text> : null}
          {busy && plan ? <ProgressBar progress={plan.total ? plan.processed / plan.total : undefined} indeterminate={!change || !plan.total} accessibilityLabel="Destination change progress" /> : null}
          {change?.state === "failed" && !change.errorFile ? <Text className="text-base text-red-700 dark:text-red-300">{change.message}</Text> : null}
          {error ? <Text accessibilityLiveRegion="polite" className="text-base text-red-700 dark:text-red-300">{error}</Text> : null}
          <View className="flex-row flex-wrap gap-2">
            <ActionButton label={change?.state === "completed" ? "Finish" : change ? "Retry move" : "Move files"} tone="primary" loading={busy} disabled={busy || !plan} onPress={() => void run("move")} />
            {change?.state !== "completed" ? <ActionButton label={change ? "Upload remaining copies" : "Leave files and upload copies"} disabled={busy || !plan} onPress={() => void run("copy")} /> : null}
            {!busy ? <ActionButton label={change ? "Continue later" : "Cancel"} onPress={onClose} /> : null}
          </View>
          {change && !busy && change.state !== "completed" ? <Text className="text-base text-muted-light dark:text-muted-dark">Uploads wait until this destination change is finished.</Text> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
