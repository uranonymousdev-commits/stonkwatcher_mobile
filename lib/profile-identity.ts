import type { User } from "@supabase/supabase-js";

const ADJECTIVES = ["Cosmic", "Lucky", "Swift", "Lunar", "Golden", "Brave", "Clever", "Sunny", "Minty", "Quiet", "Neon", "Silver", "Velvet", "Happy", "Nimble", "Stellar"];
const ANIMALS = ["Otter", "Fox", "Panda", "Falcon", "Tiger", "Koala", "Owl", "Lynx", "Dolphin", "Gecko", "Wolf", "Robin", "Badger", "Penguin", "Raven", "Whale"];

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

// Auth IDs are random UUIDs. Deriving defaults from them keeps retries and
// simultaneous first sign-ins consistent without using Google's real name.
export function defaultProfileIdentity(userId: string) {
  const hex = userId.replace(/-/g, "").toLowerCase();
  const adjective = ADJECTIVES[parseInt(hex.slice(0, 2), 16) % ADJECTIVES.length];
  const animal = ANIMALS[parseInt(hex.slice(2, 4), 16) % ANIMALS.length];
  return {
    displayName: `${adjective} ${animal}`,
    username: `${adjective}_${animal}_${hex.slice(-8)}`.toLowerCase(),
  };
}

export function profileIdentity(user: User) {
  const defaults = defaultProfileIdentity(user.id);
  const metadata = user.user_metadata ?? {};
  return {
    displayName: nonEmpty(metadata.display_name) ? metadata.display_name.trim() : defaults.displayName,
    username: nonEmpty(metadata.username) ? metadata.username.trim().replace(/^@+/, "") : defaults.username,
  };
}

export function missingProfileMetadata(user: User) {
  const identity = profileIdentity(user);
  const metadata = user.user_metadata ?? {};
  const missing: Record<string, string> = {};
  if (!nonEmpty(metadata.display_name)) missing.display_name = identity.displayName;
  if (!nonEmpty(metadata.username)) missing.username = identity.username;
  return missing;
}
