import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function getRuntimeEnv(name: 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY') {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

function createAuthClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || getRuntimeEnv('SUPABASE_URL');
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || getRuntimeEnv('SUPABASE_PUBLISHABLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Auth is not configured. Please try again after the backend is ready.');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });
}

let authClient: ReturnType<typeof createAuthClient> | undefined;

export const authSupabase = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_, prop, receiver) {
    if (!authClient) authClient = createAuthClient();
    return Reflect.get(authClient, prop, receiver);
  },
});