import type { StorageBillingData } from "src/pageComponents/storageBilling/StorageBillingTable";

export async function fetchStorageBillingItems(
  storageIds: string[],
  tenantName?: string,
  includeHistory = true,
): Promise<StorageBillingData[]> {
  const { api } = await import("src/apis");
  const results: StorageBillingData[] = [];

  for (const storageId of storageIds) {
    try {
      const resp = await api.getStorageBillingItems({ query: { storageId, tenantName } });
      let activeItem = resp.activeItems[0];
      if (!activeItem && tenantName) {
        const fallback = await api.getStorageBillingItems({ query: { storageId } });
        activeItem = fallback.activeItems[0];
      }
      results.push({
        storageId,
        activeItem,
        historyItems: includeHistory ? resp.historyItems : [],
      });
    } catch {
      results.push({ storageId, activeItem: undefined, historyItems: [] });
    }
  }

  return results;
}
