import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

/**
 * Server-side Supabase client with service_role privileges.
 * Use for uploads, deletes, and any admin storage operations.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Public Supabase client using the anon key.
 * Use for read-only / public operations.
 */
export const supabasePublic = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

/** The storage bucket name for all user uploads. */
export const STORAGE_BUCKET = "uploads";
