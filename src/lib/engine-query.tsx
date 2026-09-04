import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";

import webDavUploadEngine from "../../modules/webdav-upload-engine";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

const engineKey = ["engine"] as const;

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

export function EngineQueryProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <NativeInvalidationBridge />
      {children}
    </QueryClientProvider>
  );
}

export function useEngineSnapshot() {
  return useQuery({
    queryKey: [...engineKey, "snapshot"],
    queryFn: () => webDavUploadEngine.getSnapshot(),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: [...engineKey, "activity"],
    queryFn: () => webDavUploadEngine.getRecentActivity(),
  });
}

export function useUnresolvedFailures() {
  return useQuery({
    queryKey: [...engineKey, "failures"],
    queryFn: () => webDavUploadEngine.getUnresolvedFailures(),
  });
}
