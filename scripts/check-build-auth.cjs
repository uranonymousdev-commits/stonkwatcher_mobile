// Runs on the build worker before dependencies are installed. Check the actual
// build environment, not a developer's local .env (which is excluded from upload).
const required = [
  "EXPO_PUBLIC_PRIVY_APP_ID",
  "EXPO_PUBLIC_PRIVY_CLIENT_ID",
  "EXPO_PUBLIC_SUPABASE_URL",
];
const configured = (name) => {
  const value = process.env[name]?.trim();
  return Boolean(value && !/YOUR_|PLACEHOLDER/i.test(value));
};
const missing = required.filter((name) => !configured(name));
if (
  !configured("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
  !configured("EXPO_PUBLIC_SUPABASE_ANON_KEY")
) {
  missing.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)");
}
if (missing.length) {
  console.error(
    `Cannot build an app without Google / email sign-in configuration.\nMissing: ${missing.join(", ")}\n` +
      "Set these public client values in the selected EAS environment or build profile, then rebuild.",
  );
  process.exit(1);
}
console.log("Google / email sign-in build configuration is present.");
