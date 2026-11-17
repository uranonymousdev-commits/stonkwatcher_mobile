import { useAsync } from "./useAsync";
import { searchUsers, type SearchableUser } from "../lib/wallet-profile";

export function useSearchUsers(query: string) {
  const q = query.trim();
  return useAsync<SearchableUser[]>(() => searchUsers(q), [q], q.length > 0);
}

export type { SearchableUser };
