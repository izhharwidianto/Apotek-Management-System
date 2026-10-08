// ─── AI lewat server ────────────────────────────────────────────────────────
// API key AI TIDAK disimpan di browser. Semua permintaan AI lewat Edge Function
// `ai-proxy` di Supabase, yang memegang key sebagai secret dan mengecek bahwa
// pemanggil sudah login dengan role owner/apoteker.

import { supabase } from '@/lib/supabase';

export type AiResult = { ok: true; content: string } | { ok: false; error: string };

async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* abaikan */
    }
  }
  return error instanceof Error ? error.message : 'Gagal menghubungi server AI';
}

export async function callAI(prompt: string, systemPrompt?: string): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { prompt, systemPrompt },
  });
  if (error) return { ok: false, error: await readFunctionError(error) };
  if (!data?.content) return { ok: false, error: data?.error ?? 'Respons AI kosong' };
  return { ok: true, content: String(data.content) };
}

// Nama lama dipertahankan agar service AI yang sudah ada tidak perlu diubah.
export const callOpenRouter = callAI;

export async function getAiStatus(): Promise<{ ok: boolean; configured: boolean; model: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', { body: { ping: true } });
  if (error) return { ok: false, configured: false, model: '', error: await readFunctionError(error) };
  return { ok: true, configured: Boolean(data?.configured), model: String(data?.model ?? '') };
}
