import { createClient } from '@supabase/supabase-js';

// Renseignées automatiquement par Bolt quand Supabase est connecté (fichier .env).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;
