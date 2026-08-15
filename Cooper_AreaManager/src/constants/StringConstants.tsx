// Same backend as Cooper and Cooper_Dealer — all three apps share one API.
// Sourced from the EXPO_PUBLIC_API_URL env var (see .env) per the dev
// guide's own rule against a hardcoded BASE_URL — falls back to the
// current prototype URL only if that var is somehow missing at build time.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://cooper-corp-prototype-pp93.vercel.app';
