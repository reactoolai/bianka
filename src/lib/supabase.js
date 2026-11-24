import { createClient } from '@supabase/supabase-js';

// Projet Supabase « notaires-alma » (Canada Central).
// La clé publiable est faite pour le navigateur : la sécurité vient des règles RLS
// et de la fonction serveur. Un fichier .env peut les remplacer.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ezgvkxotymwdcvibijlp.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_r7q6cJcO7iT6zInwnwPi3Q_4Zl0sRT1';

export const supabaseReady = Boolean(url && key);
export const supabase = supabaseReady ? createClient(url, key) : null;
