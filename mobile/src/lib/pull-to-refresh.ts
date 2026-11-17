import { useState } from "react";

// Props for a RefreshControl that spins only while a pull the person made is
// loading. Background reloads don't show it. Tying the spinner to React
// Query's isRefetching instead can leave it stuck on iPhone after a reload
// that started and ended in the background, such as when a link opens a tab.
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}
