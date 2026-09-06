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
    const subscription = webDavUploadEngine.addSnapshotInvalidatedListener(() => {
      void client.invalidateQueries({ queryKey: engineKey });
    });
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

export function useStoredAccountVerification(account: AccountHealth | undefined) {
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
    queryFn: ({ pageParam }) => webDavUploadEngine.getFileInventoryPage(pageParam, filter),
    enabled,
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
    queryKey: [...engineKey, "thumbnail", sourceId, relativePath, version],
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

export function useUnresolvedFailures() {
  return useQuery({
    queryKey: [...engineKey, "failures"],
    queryFn: () => webDavUploadEngine.getUnresolvedFailures(),
  });
}
