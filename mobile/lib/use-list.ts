import { useCallback, useEffect, useRef, useState } from "react";

/**
 * fetch-once + pull-to-refresh state for the list screens. Pass a stable
 * reference (e.g. `vehiclesApi.myVehicles`) — inline arrows still work, they
 * are read through a ref so they can't retrigger the effect.
 */
export function useList<T>(load: () => Promise<T[]>) {
  const loader = useRef(load);
  loader.current = load;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setData(await loader.current());
    } catch {
      // keep the last known data; screens render an empty list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, refreshing, onRefresh, reload: fetchData };
}
