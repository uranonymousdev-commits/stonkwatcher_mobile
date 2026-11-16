// Privy WebCrypto polyfills must load before the app on native.
// Web is unsupported by @privy-io/expo — skip native polyfills there.
const isWeb =
  typeof document !== "undefined" &&
  typeof navigator !== "undefined" &&
  navigator.product !== "ReactNative";

if (!isWeb) {
  require("@privy-io/expo/polyfills");
}

require("expo-router/entry");
