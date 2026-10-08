// Edge Function: ai-proxy
// Meneruskan permintaan AI dari aplikasi ke penyedia AI (OpenAI / OpenRouter / Groq, dll).
// API key AI disimpan sebagai SECRET di Supabase, TIDAK PERNAH dikirim ke browser.
// Hanya user yang sudah login dengan role owner/apoteker yang boleh memakai.
//
// Secrets yang perlu diisi (Supabase > Edge Functions > Secrets):
//   AI_API_KEY    (wajib)  key dari penyedia AI
//   AI_BASE_URL   (opsional) default https://api.openai.com/v1/chat/completions
//   AI_MODEL      (opsional) default gpt-4o-mini
//   ALLOWED_ORIGIN (opsional) mis. https://apotekku.netlify.app  (default: *)
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_PROMPT_CHARS = 20000;
const MAX_TOKENS = 1500;
const RATE_LIMIT_PER_MINUTE = 10;

const hits = new Map<string, number[]>(); // pembatas sederhana per user (per instance)

function corsHeaders(_origin: string | null): Record<string, string> {
  const allowed = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method tidak didukung" }, 405, origin);

  // 1. Pastikan pemanggil adalah user login dengan role yang boleh.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Belum login" }, 401, origin);
  const { data: role } = await supabase.rpc("app_role");
  if (role !== "owner" && role !== "apoteker") return json({ error: "Tidak diizinkan" }, 403, origin);

  // 2. Pembatas laju.
  const uid = userData.user.id;
  const now = Date.now();
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) return json({ error: "Terlalu banyak permintaan, coba lagi sebentar" }, 429, origin);
  recent.push(now);
  hits.set(uid, recent);

  // 3. Baca input.
  let body: { prompt?: string; systemPrompt?: string; ping?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body tidak valid" }, 400, origin);
  }

  const apiKey = Deno.env.get("AI_API_KEY");
  const baseUrl = Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1/chat/completions";
  const model = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";

  if (body.ping) return json({ configured: Boolean(apiKey), model }, 200, origin);
  if (!apiKey) return json({ error: "AI belum dikonfigurasi di server (secret AI_API_KEY belum diisi)" }, 503, origin);

  const prompt = String(body.prompt ?? "");
  if (!prompt.trim()) return json({ error: "Prompt kosong" }, 400, origin);
  const cut = prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) + "\n... (data dipangkas)" : prompt;
  const messages: { role: string; content: string }[] = [];
  if (body.systemPrompt) messages.push({ role: "system", content: String(body.systemPrompt).slice(0, 4000) });
  messages.push({ role: "user", content: cut });

  // 4. Panggil penyedia AI.
  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: MAX_TOKENS }),
    });
    if (!res.ok) {
      const t = await res.text();
      let msg = `HTTP ${res.status}`;
      try { msg = JSON.parse(t).error?.message ?? msg; } catch { /* abaikan */ }
      return json({ error: `Penyedia AI menolak: ${msg}` }, 502, origin);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Respons AI kosong" }, 502, origin);
    return json({ content }, 200, origin);
  } catch (e) {
    return json({ error: `Gagal menghubungi penyedia AI: ${e instanceof Error ? e.message : "error"}` }, 502, origin);
  }
});
