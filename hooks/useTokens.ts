import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibleRows } from "../components/BlacklistContext";
import { fetchTokens } from "../lib/stonk";
import { tokenMint } from "../lib/solana";
import type { StonkFunToken } from "../lib/types";

const PAGE_SIZE = 30;

type State = {
  key: string;
  rows: StonkFunToken[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

function initial(key: string): State {
  return { key, rows: [], page: 0, hasMore: true, loading: true, loadingMore: false, error: null };
}

export function useTokens(tab: "Trending" | "New") {
  const sort = tab === "New" ? "newest" : "volume";
  const [state, setState] = useState<State>(() => initial(sort));
  // Guards against firing the same page twice from rapid onEndReached events.
  const requested = useRef<string | null>(null);

  const load = useCallback((page: number) => {
    const tag = `${sort}:${page}`;
    if (requested.current === tag) return;
    requested.current = tag;
    setState((prev) =>
      prev.key === sort
        ? { ...prev, loading: page === 1, loadingMore: page > 1, error: null }
        : initial(sort),
    );
    fetchTokens({ sort, pageSize: PAGE_SIZE, page })
      .then((result) => {
        const fresh = (result.tokens ?? []).filter((token) => tokenMint(token));
        const totalPages = result.pagination?.totalPages;
        setState((prev) => {
          if (prev.key !== sort) return prev;
          const seen = new Set(prev.rows.map((row) => tokenMint(row)));
          const rows = page === 1 ? fresh : [...prev.rows, ...fresh.filter((row) => !seen.has(tokenMint(row)))];
          const hasMore = totalPages ? page < totalPages : fresh.length >= PAGE_SIZE;
          return { ...prev, rows, page, hasMore, loading: false, loadingMore: false, error: null };
        });
      })
      .catch((err: unknown) => {
        if (requested.current === tag) requested.current = null; // allow a retry
        setState((prev) =>
          prev.key !== sort
            ? prev
            : {
                ...prev,
                loading: false,
                loadingMore: false,
                error: err instanceof Error ? err.message : "Could not load data",
              },
        );
      });
  }, [sort]);

  useEffect(() => {
    requested.current = null;
    load(1);
  }, [load]);

  const current = state.key === sort ? state : initial(sort);
  const loadMore = useCallback(() => {
    if (current.loading || current.loadingMore || !current.hasMore || current.page < 1) return;
    load(current.page + 1);
  }, [current.loading, current.loadingMore, current.hasMore, current.page, load]);

  const data = useVisibleRows(current.page > 0 ? current.rows : null);
  return {
    data,
    loading: current.loading,
    loadingMore: current.loadingMore,
    hasMore: current.hasMore,
    page: current.page,
    error: current.error,
    loadMore,
  };
}
