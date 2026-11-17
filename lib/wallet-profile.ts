import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultProfileIdentity } from "./profile-identity";
import { isSolanaAddress } from "./solana";
import { supabase, supabaseReady } from "./supabase";

export type WalletProfile = {
  address: string;
  displayName: string;
  username: string;
  bio: string;
  updatedAt: string;
};

const PROFILE_KEY = "stonkwatcher.wallet.profile.v1:";
const DIRECTORY_KEY = "stonkwatcher.user.directory.v1";

function normalizeHandle(value: string) {
  return value.replace(/^@+/, "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function profileKey(address: string) {
  return `${PROFILE_KEY}${address}`;
}

function seedProfile(address: string): WalletProfile {
  const identity = defaultProfileIdentity(address);
  return {
    address,
    displayName: identity.displayName,
    username: normalizeHandle(identity.username),
    bio: "",
    updatedAt: new Date().toISOString(),
  };
}

function asProfile(row: unknown): WalletProfile | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const address = String(value.address || "");
  const username = normalizeHandle(String(value.username || ""));
  const displayName = String(value.displayName || value.display_name || "").trim();
  if (!isSolanaAddress(address) || !username || !displayName) return null;
  return {
    address,
    displayName,
    username,
    bio: typeof value.bio === "string" ? value.bio : "",
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at === "string"
          ? value.updated_at
          : new Date().toISOString(),
  };
}

async function readDirectory(): Promise<WalletProfile[]> {
  const raw = await AsyncStorage.getItem(DIRECTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(asProfile).filter((row): row is WalletProfile => Boolean(row));
  } catch {
    return [];
  }
}

async function writeDirectory(rows: WalletProfile[]) {
  const unique = new Map<string, WalletProfile>();
  for (const row of rows) unique.set(row.address, row);
  await AsyncStorage.setItem(DIRECTORY_KEY, JSON.stringify([...unique.values()]));
}

async function upsertDirectory(profile: WalletProfile) {
  const rows = await readDirectory();
  const next = rows.filter(
    (row) => row.address !== profile.address && row.username !== profile.username,
  );
  next.push(profile);
  await writeDirectory(next);
}

async function syncRemote(profile: WalletProfile) {
  if (!supabaseReady) return;
  try {
    await supabase.from("wallet_profiles").upsert(
      {
        address: profile.address,
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
        updated_at: profile.updatedAt,
      },
      { onConflict: "address" },
    );
  } catch {
    /* remote directory is best-effort */
  }
}

export async function loadWalletProfile(address: string) {
  if (!isSolanaAddress(address)) return null;
  const raw = await AsyncStorage.getItem(profileKey(address));
  if (!raw) return null;
  try {
    return asProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** First login seeds a random-looking handle from the wallet address (stable per user). */
export async function ensureWalletProfile(address: string) {
  const existing = await loadWalletProfile(address);
  if (existing) {
    await upsertDirectory(existing);
    void syncRemote(existing);
    return existing;
  }
  const profile = seedProfile(address);
  await AsyncStorage.setItem(profileKey(address), JSON.stringify(profile));
  await upsertDirectory(profile);
  void syncRemote(profile);
  return profile;
}

export async function saveWalletProfile(
  address: string,
  patch: Partial<Pick<WalletProfile, "displayName" | "username" | "bio">>,
) {
  const current = (await loadWalletProfile(address)) || seedProfile(address);
  const next: WalletProfile = {
    ...current,
    displayName:
      patch.displayName !== undefined ? patch.displayName.trim() || current.displayName : current.displayName,
    username:
      patch.username !== undefined
        ? normalizeHandle(patch.username) || current.username
        : current.username,
    bio: patch.bio !== undefined ? patch.bio : current.bio,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(profileKey(address), JSON.stringify(next));
  await upsertDirectory(next);
  void syncRemote(next);
  return next;
}

export type SearchableUser = {
  address: string;
  displayName: string;
  username: string;
  bio: string;
};

export async function searchUsers(query: string, limit = 12): Promise<SearchableUser[]> {
  const q = query
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[%_,.()]/g, "");
  if (!q) return [];

  const local = (await readDirectory()).filter((row) => {
    return (
      row.username.includes(q) ||
      row.displayName.toLowerCase().includes(q) ||
      row.address.toLowerCase().includes(q)
    );
  });

  const byAddress = new Map<string, SearchableUser>();
  for (const row of local) {
    byAddress.set(row.address, {
      address: row.address,
      displayName: row.displayName,
      username: row.username,
      bio: row.bio,
    });
  }

  if (supabaseReady) {
    try {
      const { data } = await supabase
        .from("wallet_profiles")
        .select("address,username,display_name,bio")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(limit);
      for (const row of data ?? []) {
        const address = String((row as { address?: string }).address || "");
        const username = normalizeHandle(String((row as { username?: string }).username || ""));
        const displayName = String(
          (row as { display_name?: string }).display_name || "",
        ).trim();
        if (!isSolanaAddress(address) || !username || !displayName) continue;
        byAddress.set(address, {
          address,
          displayName,
          username,
          bio: typeof (row as { bio?: string }).bio === "string" ? (row as { bio: string }).bio : "",
        });
      }
    } catch {
      /* local directory still works */
    }
  }

  return [...byAddress.values()].slice(0, limit);
}
