/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const identity = loadModule("lib/profile-identity.ts");
const user = { id: "f7d1275c-3f83-42d1-9bb8-22f5a4b93e21", user_metadata: { full_name: "Private Google Name" }, app_metadata: { provider: "google" } };

test("first account gets readable names without exposing Google's real name", () => {
  const defaults = identity.profileIdentity(user);
  assert.match(defaults.displayName, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
  assert.match(defaults.username, /^[a-z]+_[a-z]+_[a-f0-9]{8}$/);
  assert.notEqual(defaults.displayName, user.user_metadata.full_name);
  assert.deepEqual(JSON.parse(JSON.stringify(identity.missingProfileMetadata(user))), {
    display_name: defaults.displayName,
    username: defaults.username,
  });
});

test("retries and different devices derive the same defaults for an account", () => {
  assert.equal(identity.profileIdentity(user).username, identity.profileIdentity({ ...user }).username);
  assert.equal(identity.profileIdentity(user).displayName, identity.profileIdentity({ ...user }).displayName);
  assert.notEqual(identity.profileIdentity(user).username, identity.profileIdentity({ ...user, id: "f7d1275c-3f83-42d1-9bb8-22f5ffffffff" }).username);
});

test("returning accounts keep chosen names and only missing fields are filled", () => {
  const returning = { ...user, user_metadata: { display_name: "My Display Name", username: "@my_handle" } };
  assert.equal(identity.profileIdentity(returning).displayName, "My Display Name");
  assert.equal(identity.profileIdentity(returning).username, "my_handle");
  assert.equal(Object.keys(identity.missingProfileMetadata(returning)).length, 0);
  const partial = { ...user, user_metadata: { display_name: "My Display Name", username: "  " } };
  assert.equal(identity.missingProfileMetadata(partial).display_name, undefined);
  assert.equal(identity.missingProfileMetadata(partial).username, identity.profileIdentity(user).username);
});

function authHarness(initialUser, profileError = null) {
  let currentUser = initialUser;
  const metadataWrites = [];
  const profileWrites = [];
  const supabase = {
    auth: {
      async updateUser({ data }) {
        metadataWrites.push(data);
        currentUser = { ...currentUser, user_metadata: { ...currentUser.user_metadata, ...data } };
        return { data: { user: currentUser }, error: null };
      },
    },
    from(table) {
      assert.equal(table, "profiles");
      return { async upsert(row) { profileWrites.push(row); return { error: profileError }; } };
    },
  };
  const auth = loadModule("lib/auth.ts", {
    "expo-linking": {},
    "react-native": { Platform: { OS: "ios" } },
    "expo-web-browser": { maybeCompleteAuthSession() {} },
    "expo-auth-session": {},
    "./config": {},
    "./supabase": { supabase, supabaseReady: true },
    "./profile-identity": identity,
  });
  return { auth, metadataWrites, profileWrites, getUser: () => currentUser };
}

test("new names persist once and profile sync preserves later custom names", async () => {
  const harness = authHarness(user);
  await harness.auth.syncProfile(user);
  assert.equal(harness.metadataWrites.length, 1);
  assert.equal(harness.profileWrites[0].display_name, identity.profileIdentity(user).displayName);
  await harness.auth.syncProfile(harness.getUser());
  assert.equal(harness.metadataWrites.length, 1);
  const edited = { ...harness.getUser(), user_metadata: { display_name: "Custom Name", username: "custom_handle" } };
  await harness.auth.syncProfile(edited);
  assert.equal(harness.metadataWrites.length, 1);
  assert.equal(harness.profileWrites.at(-1).display_name, "Custom Name");
});

test("account names still persist when the optional profiles table is absent", async () => {
  const harness = authHarness(user, { code: "PGRST205" });
  await harness.auth.syncProfile(user);
  assert.equal(harness.getUser().user_metadata.username, identity.profileIdentity(user).username);
});

test("failed metadata writes are surfaced and do not write an unsaved profile", async () => {
  // A separate loader lets this test model an auth API failure.
  const failure = { message: "offline" };
  const auth = loadModule("lib/auth.ts", {
    "expo-linking": {}, "react-native": { Platform: { OS: "ios" } },
    "expo-web-browser": { maybeCompleteAuthSession() {} }, "expo-auth-session": {}, "./config": {},
    "./profile-identity": identity,
    "./supabase": { supabaseReady: true, supabase: { auth: { updateUser: async () => ({ error: failure }) }, from() { throw new Error("Should not write profile"); } } },
  });
  await assert.rejects(auth.syncProfile(user), (error) => error === failure);
});
