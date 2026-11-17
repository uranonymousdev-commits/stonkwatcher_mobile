Mobile companion app for [Stonk Watcher](https://www.stonkwatcher.xyz) - on-chain intelligence, portfolio, DEX trading, StonkFun rewards, blacklist, and tracer for Solana / StonkFun launches.

Built with **Expo SDK 58**, **React Native**, and **Expo Router**.

## Android client build

Build the current Google / email wallet login for client testing:

```bash
npx eas-cli@latest build --platform android --profile uat
```

Install the APK from the resulting build link. Older APKs may still contain the
Supabase login flow and missing configuration; restarting them does not update it.

The `uat` profile includes the public Supabase URL / publishable key and Privy app /
native client IDs so cloud builds do not depend on an ignored local `.env` file.
The iOS simulator profile inherits these values. For production, configure the same
variable names with the intended production values in the EAS `production`
environment. Never add service-role keys or OAuth client secrets to the build profile.
Builds fail early if authentication configuration is missing or still a placeholder.

## Features

- Wallet portfolio (holdings, chart, send / withdraw)
- In-app Solana wallet via Privy (email login, deposit address, key export)
- Tokens feed with quote filter
- DEX trading + paper trade
- Live trading via Privy embedded wallet (Google / email login)
- 0.5% platform fee on live swaps (`EXPO_PUBLIC_PLATFORM_FEE_BPS`)
- StonkFun Rewards Calendar & PnL (Panel) Mode
- Rewards Snapshot sharing
- Blacklist
- Tracer (holders, linked wallets, bubble map)

## Privy embedded wallet

1. Create an app + **native app client** in the [Privy dashboard](https://dashboard.privy.io) (scheme `stonkwatcher`).
2. Copy `.env.example` → `.env` and set `EXPO_PUBLIC_PRIVY_APP_ID` + `EXPO_PUBLIC_PRIVY_CLIENT_ID`.
3. Set `EXPO_PUBLIC_PLATFORM_FEE_ACCOUNT` to your Solana treasury for the 0.5% fee.
4. Host a small web page that uses Privy’s React `exportWallet` for Solana, and point `EXPO_PUBLIC_PRIVY_KEY_EXPORT_URL` at it.
5. Privy needs native modules — use a **development build**, not Expo Go:

```bash
npx expo run:ios
# or
npx expo run:android
# or
npx eas-cli@latest build --profile development
```

## Run locally

Copy `.env.example` and fill in keys (Privy + API). Then:

```bash
npx expo start
```

Then:

- press `a` for Android emulator / connected device  
- scan the QR with a **dev client** (Privy will not run in Expo Go)  
- press `w` for web (external wallets only; Privy is native-only)

Other entry points:

```bash
npm run android   # expo start --android
npm run ios       # expo start --ios
npm run web       # expo start --web
```

# Next
Soon available on IOS
