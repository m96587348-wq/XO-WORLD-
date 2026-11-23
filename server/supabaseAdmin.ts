import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SystemConfigStatus } from '../src/types/xo';

let adminClient: SupabaseClient | null = null;

export function getSystemConfigStatus(): SystemConfigStatus {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anon = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const supabaseUrlConfigured = Boolean(url && url.startsWith('https://'));
  const supabaseAnonKeyConfigured = Boolean(anon && anon.length > 20);
  const supabaseServiceKeyConfigured = Boolean(service && service.length > 20);
  const isSupabaseConnected =
    supabaseUrlConfigured && supabaseAnonKeyConfigured && supabaseServiceKeyConfigured;

  const missingKeys: string[] = [];
  if (!supabaseUrlConfigured) missingKeys.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKeyConfigured) missingKeys.push('VITE_SUPABASE_ANON_KEY');
  if (!supabaseServiceKeyConfigured) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    supabaseUrlConfigured,
    supabaseAnonKeyConfigured,
    supabaseServiceKeyConfigured,
    isSupabaseConnected,
    onlinePaymentsConfigured: Boolean((process.env.PAYMENT_PROVIDER_SECRET || '').trim()),
    mode: isSupabaseConnected ? 'supabase' : 'local_preview',
    missingKeys,
  };
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const status = getSystemConfigStatus();
  if (!status.isSupabaseConnected) {
    return null;
  }
  if (!adminClient) {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
