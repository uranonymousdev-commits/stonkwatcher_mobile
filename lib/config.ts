export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://www.stonkwatcher.xyz"
).replace(/\/$/, "");

export const STONKFUN_SITE = "https://stonkfun.xyz";
export const STONKFUN_API_URL = `${STONKFUN_SITE}/api/public/v1`;

export const PARTNER_API_KEY = process.env.EXPO_PUBLIC_PARTNER_API_KEY || "";

export const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL || ""
).replace(/\/$/, "");

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

export const AUTH_REDIRECT_PATH = "auth/callback";

/** Privy dashboard App ID + native client ID (required for embedded wallets). */
export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || "";
export const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || "";

/** Hosted web page that runs Privy's Solana exportWallet (Expo cannot export keys natively). */
export const PRIVY_KEY_EXPORT_URL =
  process.env.EXPO_PUBLIC_PRIVY_KEY_EXPORT_URL ||
  `${(process.env.EXPO_PUBLIC_API_URL || "https://www.stonkwatcher.xyz").replace(/\/$/, "")}/wallet/export`;

export const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/** 0.5% platform fee on live swaps (50 bps). */
export const PLATFORM_FEE_BPS = Number(process.env.EXPO_PUBLIC_PLATFORM_FEE_BPS || "50");
export const PLATFORM_FEE_ACCOUNT = process.env.EXPO_PUBLIC_PLATFORM_FEE_ACCOUNT || "";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const SEARCH_RECENTS_KEY = "stonkwatcher.search.recents";
export const BLACKLIST_KEY = "stonkwatcher.blacklist";
export const MOCK_PORTFOLIO_KEY = "stonkwatcher.mock-portfolio";
export const MOCK_STARTING_CASH = 0;
export const PAPER_TRADE_CASH = 10_000;
export const MOCK_TRADE_FEE = 0.95;

export type SelectedQuote = {
  symbol: string;
  mint?: string;
};

export const ALL_QUOTES: SelectedQuote = { symbol: "All Quotes" };

export const FALLBACK_QUOTES: SelectedQuote[] = [
  ALL_QUOTES,
  { symbol: "SOL", mint: WSOL_MINT },
  { symbol: "USDC", mint: USDC_MINT },
];
