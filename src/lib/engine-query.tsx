import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";

import webDavUploadEngine, {
  type AccountHealth,
  type FileInventoryFilter,
} from "../../modules/webdav-upload-engine";
import { enginePollInterval } from "./engine-polling";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

const engineKey = ["engine"] as const;
const accountVerificationKey = ["account-verification"] as const;

function NativeInvalidationBridge() {
  const client = useQueryClient();

  useEffect(() => {
    const subscription = webDavUploadEngine.addSnapshotInvalidatedListener(
      () => {
        void client.invalidateQueries({ queryKey: engineKey });
      },
    );
    return () => subscription.remove();
  }, [client]);

  return null;
}

function AutomaticAccountVerification() {
  const { data: snapshot } = useEngineSnapshot();

  useStoredAccountVerification(snapshot?.account);
  return null;
}

export function EngineQueryProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <NativeInvalidationBridge />
      <AutomaticAccountVerification />
      {children}
    </QueryClientProvider>
  );
}

export function useEngineSnapshot() {
  return useQuery({
    queryKey: [...engineKey, "snapshot"],
    queryFn: () => webDavUploadEngine.getSnapshot(),
    refetchInterval: (query) => enginePollInterval(query.state.data),
    refetchIntervalInBackground: false,
  });
}

export function useStoredAccountVerification(
  account: AccountHealth | undefined,
) {
  const accountId = account?.status === "connected" ? account.id : null;

  return useQuery({
    queryKey: [...accountVerificationKey, accountId],
    queryFn: async () => {
      const result = await webDavUploadEngine.verifyStoredAccount();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    },
    enabled: accountId !== null,
    retry: false,
    retryOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useActivityPages() {
  return useInfiniteQuery({
    queryKey: [...engineKey, "activity"],
    queryFn: ({ pageParam }) => webDavUploadEngine.getActivityPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });
}

export function useFileInventoryPages(
  filter: FileInventoryFilter = { sourceId: null, status: "all" },
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: [...engineKey, "file-inventory", filter],
    queryFn: ({ pageParam }) =>
      webDavUploadEngine.getFileInventoryPage(pageParam, filter),
    enabled,
    refetchInterval: enabled ? 15_000 : false,
    refetchIntervalInBackground: false,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });
}

export function useRemoteThumbnail(
  sourceId: string,
  relativePath: string,
  version: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["thumbnail", sourceId, relativePath, version],
    queryFn: async () => {
      const result = await webDavUploadEngine.getRemoteThumbnail(
        sourceId,
        relativePath,
        version,
      );
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useUnresolvedFailures(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...engineKey, "failures"],
    queryFn: () => webDavUploadEngine.getUnresolvedFailures(),
  });
}

/** Refresh the complete media-folder index while the suggestions screen is open. */
export function useMediaFolders(enabled: boolean) {
  return useQuery({
    queryKey: ["media-folders"],
    queryFn: async () => {
      const permission = await webDavUploadEngine.getMediaPermission();
      if (!permission.ok) throw new Error(permission.error.message);
      if (permission.value.access === "denied") return { permission: permission.value, folders: [] };
      const result = await webDavUploadEngine.getMediaFolders();
      if (!result.ok) throw new Error(result.error.message);
      return { permission: permission.value, folders: result.value };
    },
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
}
