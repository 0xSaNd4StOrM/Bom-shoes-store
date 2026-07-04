// Standard CORS headers shared by every edge function so the browser
// (supabase.functions.invoke from the anon-key frontend client) can call them.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
