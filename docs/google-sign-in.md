# Google sign-in setup

The login screen uses Google OAuth through Supabase Auth. Guest access stays local. No new dependencies are required.

## 1. Connect this app's Supabase project

Copy `.env.example` to `.env`. Set the URL and publishable key from your new Supabase project's **Settings → Data API / API Keys**. A legacy anon key is also supported through `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Never put a Google client secret or Supabase secret/service-role key in the app. Public environment variables are bundled into the app.

## 2. Configure Google

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) in the Google Cloud project for this app.
2. Set up Branding and Audience. While the app is in Testing, add the Google accounts that will test sign-in as test users.
3. Configure the `openid`, `userinfo.email`, and `userinfo.profile` scopes.
4. Under Clients, create an OAuth client with application type **Web application**. This browser-based Supabase flow uses a web client on both mobile platforms.
5. Add the exact **Authorized redirect URI** shown in Supabase's Google provider settings. Normally it is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
6. In Supabase → **Authentication → Sign In / Providers → Google**, enable Google, enter the client ID and client secret, and save. The secret belongs only here.

## 3. Allow returns to the app

In Supabase → **Authentication → URL Configuration → Redirect URLs**, add:

```text
stonkwatcher://auth/callback
```

For web development, also add the exact local web callback URL (for example `http://localhost:8081/auth/callback` if Expo uses port 8081). Add the deployed web origin plus `/auth/callback` for production. Set the Site URL to your actual web address if you deploy the web app.

Google redirects to Supabase's HTTPS callback; Supabase then redirects to the app. These are separate settings.

## 4. Restart and verify

Restart Expo after setting `.env`. Test mobile sign-in in an installed development/internal build with the `stonkwatcher` scheme, rather than Expo Go. The scheme and browser plugin are already configured in `app.json`.

For cloud builds, set the same two public variables in the Expo environment used by the build: `preview` for the existing `uat` profile or `production` for the production profile.

Check that:

- Google opens, the chosen account returns to Wallet, and Supabase Authentication → Users shows the account.
- Closing the Google sign-in window leaves login usable without a failure alert.
- Restarting the app restores the account; signing out returns to login.
- Continue as Guest still works.
- Web sign-in returns in the same browser tab.

The existing profile sync is optional: sign-in can work without a `profiles` table. Other app data is not automatically migrated from guest storage or another database by signing in.

References: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [mobile redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Expo SDK 58 AuthSession](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/).
