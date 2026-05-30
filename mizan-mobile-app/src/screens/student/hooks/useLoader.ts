import { useCallback, useRef, useState, type DependencyList } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getApiErrorMessage } from "../../../lib/api";

export function useLoader<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setData(await loaderRef.current());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, ...deps])
  );

  return { data, loading, error, load, setData, setError };
}
