/*
 * Configurazione Supabase (pubblica per design: la sicurezza è data da RLS e cifratura E2E).
 * Qui stanno solo l'URL del progetto e la chiave pubblica (`anon` / publishable). MAI la `service_role` key.
 * Valori vuoti = sincronizzazione cloud non configurata: l'app funziona solo in locale.
 */
export const SUPABASE_URL = 'https://hsnzyyynsstxaodkozzv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_wFR753ZmdrbRreKYDy_DJg_hnS-xfbE';
