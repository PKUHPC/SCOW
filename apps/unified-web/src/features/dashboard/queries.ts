import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboardClient } from "src/features/dashboard/client";
import type { DashboardSource, QuickEntriesData } from "src/features/dashboard/types";

export const useDashboardQuery = (enabledSources: DashboardSource[]) =>
  useQuery({
    queryKey: ["dashboard", enabledSources],
    queryFn: async () => (await getDashboardClient()).getDashboardData(enabledSources),
    enabled: enabledSources.length > 0,
    refetchInterval: 60_000,
  });

const quickEntriesKey = ["dashboard", "quickEntries"] as const;

export const useQuickEntriesQuery = (
  enabledSources: DashboardSource[],
  sourceBasePaths: Partial<Record<DashboardSource, string>>,
) =>
  useQuery({
    queryKey: [...quickEntriesKey, enabledSources, sourceBasePaths],
    queryFn: async () => (await getDashboardClient()).listQuickEntries(enabledSources, sourceBasePaths),
    enabled: enabledSources.length > 0,
  });

export const useSaveQuickEntriesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, entries }: Pick<QuickEntriesData, "source" | "entries">) =>
      (await getDashboardClient()).saveQuickEntries(source, entries),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quickEntriesKey }),
  });
};
