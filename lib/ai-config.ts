// ─── Multi-provider AI config ──────────────────────────────────────────────
// Supports: OpenRouter, Groq, OpenAI, Together AI, Fireworks AI, and any
// OpenAI-compatible endpoint. Auto-detects which provider + model works
// for a given API key so the user never has to know the details.

export const AI_KEY_STORAGE = 'apotekz_ai_key';
export const AI_PROVIDER_STORAGE = 'apotekz_ai_provider';
export const AI_MODEL_STORAGE = 'apotekz_ai_model';
export const AI_BASEURL_STORAGE = 'apotekz_ai_baseurl';

const ENV_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? '';

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  keyPrefix: string; // hint for auto-detection (empty = no specific prefix)
  models: string[];
  free: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyPrefix: 'gsk_',
    free: true,
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile',
      'gemma2-9b-it',
      'llama-3.2-1b-preview',
      'llama-3.2-3b-preview',
      'llama-3.2-11b-vision-preview',
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPrefix: 'sk-or-v1-',
    free: true,
    models: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'meta-llama/llama-3.2-1b-instruct:free',
      'google/gemma-2-9b-it:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'qwen/qwen-2.5-3b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct',
      'anthropic/claude-3.5-haiku',
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    keyPrefix: '',
    free: false,
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'google/gemma-2-9b-it',
      'Qwen/Qwen2.5-7B-Instruct-Turbo',
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    keyPrefix: '',
    free: false,
    models: [
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/llama-v3p1-8b-instruct',
      'accounts/fireworks/models/qwen2p5-7b-instruct',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    keyPrefix: 'sk-',
    free: false,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  },
];

// ─── Storage helpers ───────────────────────────────────────────────────────

export function getApiKey(): string | null {
  if (typeof window !== 'undefined') {
    const k = localStorage.getItem(AI_KEY_STORAGE);
    if (k && k.trim().length > 5) return k.trim();
  }
  if (ENV_KEY && ENV_KEY.trim().length > 5) return ENV_KEY.trim();
  return null;
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) localStorage.setItem(AI_KEY_STORAGE, key.trim());
  else localStorage.removeItem(AI_KEY_STORAGE);
}

export function getSavedProvider(): string {
  if (typeof window !== 'undefined') return localStorage.getItem(AI_PROVIDER_STORAGE) ?? '';
  return '';
}

export function getSavedModel(): string {
  if (typeof window !== 'undefined') return localStorage.getItem(AI_MODEL_STORAGE) ?? '';
  return '';
}

export function getSavedBaseUrl(): string {
  if (typeof window !== 'undefined') return localStorage.getItem(AI_BASEURL_STORAGE) ?? '';
  return '';
}

export function saveConnection(provider: string, model: string, baseUrl: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_PROVIDER_STORAGE, provider);
  localStorage.setItem(AI_MODEL_STORAGE, model);
  localStorage.setItem(AI_BASEURL_STORAGE, baseUrl);
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

// ─── Core API call ──────────────────────────────────────────────────────────

function truncatePrompt(prompt: string, maxChars = 6000): string {
  if (prompt.length <= maxChars) return prompt;
  const cut = prompt.lastIndexOf('\n', maxChars);
  return prompt.slice(0, cut > 2000 ? cut : maxChars) + '\n... (data dipangkas)';
}

function buildHeaders(apiKey: string, providerId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://apotekz.app';
    headers['X-Title'] = 'ApotekZ Management System';
  }
  return headers;
}

async function tryModel(
  apiKey: string,
  provider: ProviderDef,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  try {
    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: buildHeaders(apiKey, provider.id),
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message ?? errMsg;
      } catch {
        if (errText) errMsg = errText.slice(0, 300);
      }
      return { ok: false, status: response.status, error: errMsg };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, status: 200, error: 'Response AI kosong' };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Network error' };
  }
}

function guessProvider(key: string): ProviderDef[] {
  const k = key.trim();
  for (const p of PROVIDERS) {
    if (p.keyPrefix && k.startsWith(p.keyPrefix)) return [p, ...PROVIDERS.filter((x) => x.id !== p.id)];
  }
  // Unknown prefix — try all, free first
  return [...PROVIDERS.filter((p) => p.free), ...PROVIDERS.filter((p) => !p.free)];
}

// ─── Auto-detect: tries providers + models until one works ──────────────────

export interface DetectProgress {
  provider: string;
  model: string;
  status: 'testing' | 'ok' | 'skip';
}

export interface DetectResult {
  ok: boolean;
  provider?: ProviderDef;
  model?: string;
  message: string;
  tried: { provider: string; model: string; status: string }[];
}

export async function autoDetectConnection(
  apiKey: string,
  onProgress?: (p: DetectProgress) => void,
): Promise<DetectResult> {
  if (!apiKey.trim()) {
    return { ok: false, message: 'API key kosong.', tried: [] };
  }

  const orderedProviders = guessProvider(apiKey);
  const tried: { provider: string; model: string; status: string }[] = [];

  for (const provider of orderedProviders) {
    for (const model of provider.models) {
      onProgress?.({ provider: provider.label, model, status: 'testing' });

      const result = await tryModel(
        apiKey,
        provider,
        model,
        [{ role: 'user', content: 'Respond with only: OK' }],
        16,
      );

      if (result.ok) {
        tried.push({ provider: provider.label, model, status: 'ok' });
        saveConnection(provider.id, model, provider.baseUrl);
        return {
          ok: true,
          provider,
          model,
          message: `Berhasil! Terhubung via ${provider.label} dengan model ${model}`,
          tried,
        };
      }

      const errLower = result.error.toLowerCase();

      // Auth error — this provider doesn't accept this key, skip to next provider
      if (result.status === 401 || result.status === 403) {
        tried.push({ provider: provider.label, model, status: 'skip (auth)' });
        break; // skip remaining models for this provider
      }

      // Model unavailable — try next model
      tried.push({ provider: provider.label, model, status: 'skip' });
      continue;
    }
  }

  return {
    ok: false,
    message: 'Tidak ada provider/model yang cocok dengan API key ini. Periksa key atau kredit Anda.',
    tried,
  };
}

// ─── Main call used by dashboards ───────────────────────────────────────────

export async function callAI(
  prompt: string,
  systemPrompt?: string,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'API key AI belum dipasang. Klik tombol Pengaturan AI untuk menambahkan.' };
  }

  const providerId = getSavedProvider();
  const model = getSavedModel();
  const baseUrl = getSavedBaseUrl();

  let provider: ProviderDef | undefined = PROVIDERS.find((p) => p.id === providerId);

  // If no saved connection or custom baseUrl, try to reconstruct
  if (!provider || !model) {
    // Fall back to auto-detection
    const detect = await autoDetectConnection(apiKey);
    if (detect.ok && detect.provider && detect.model) {
      provider = detect.provider;
    } else {
      return { ok: false, error: detect.message };
    }
  }

  // Use custom baseUrl if saved (for custom OpenAI-compatible endpoints)
  if (baseUrl && provider) {
    provider = { ...provider, baseUrl };
  }

  const actualModel = model || provider.models[0];

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: truncatePrompt(prompt) });

  // Try with saved model, then fallback through provider's other models
  const modelQueue = [actualModel, ...provider.models.filter((m) => m !== actualModel)];
  const tokenSteps = [1024, 768, 512];

  let lastError = '';

  for (const m of modelQueue) {
    for (const maxTok of tokenSteps) {
      const result = await tryModel(apiKey, provider, m, messages, maxTok);
      if (result.ok) {
        // Save the working model for next time
        saveConnection(provider.id, m, provider.baseUrl);
        return result;
      }

      lastError = result.error;

      if (result.status === 401 || result.status === 403) {
        return { ok: false, error: 'API key tidak valid. Periksa kembali key Anda.' };
      }
      if (result.status === 404 || lastError.toLowerCase().includes('unavailable')) break; // try next model
      if (result.status === 402) continue; // try fewer tokens
      break; // other error, try next model
    }
  }

  return { ok: false, error: `AI gagal merespon: ${lastError}. Coba ganti model di Pengaturan AI.` };
}

// Backward-compatible alias
export const callOpenRouter = callAI;
export const testConnection = async (): Promise<{ ok: boolean; model: string; message: string }> => {
  const key = getApiKey();
  if (!key) return { ok: false, model: '', message: 'API key belum dipasang.' };
  const result = await autoDetectConnection(key);
  return { ok: result.ok, model: result.model ?? '', message: result.message };
};
