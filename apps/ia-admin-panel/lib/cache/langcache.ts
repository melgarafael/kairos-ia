import { LangCache } from "@redis-ai/langcache";

const serverURL =
  process.env.LANGCACHE_SERVER_URL ?? process.env.NEXT_PUBLIC_LANGCACHE_SERVER_URL;
const cacheId = process.env.LANGCACHE_CACHE_ID;
const apiKey = process.env.LANGCACHE_API_KEY;

type SearchStrategyLiteral = "exact" | "semantic";
const EXACT_SEARCH_STRATEGY: SearchStrategyLiteral = "exact";

const langCache =
  serverURL && cacheId && apiKey
    ? new LangCache({
        serverURL,
        cacheId,
        apiKey
      })
    : null;

type StoredCacheRecord<T> = {
  value: T;
};

// Helper to find entry by exact prompt match since we can't use attributes
async function findEntryByPrompt(key: string) {
    if (!langCache) return null;
    try {
        const result = await langCache.search({
            prompt: key,
            similarityThreshold: 0.99,
            searchStrategies: [EXACT_SEARCH_STRATEGY]
        });

        // Double check exact match of prompt to be sure
        const match = result.data.find(item => item.prompt === key);
        return match || null;
    } catch (error) {
        console.error("[langcache] search failed", error);
        return null;
    }
}

async function deleteEntryById(entryId: string) {
    if (!serverURL || !cacheId || !apiKey) return;

    // Fallback to fetch because SDK might not expose delete method correctly or it's missing
    // Construct URL: https://[host]/v1/caches/{cacheId}/entries/{entryId}
    const baseUrl = serverURL.replace(/\/$/, ""); 
    // Note: serverURL usually implies the API base. If it contains /v1/caches already we need to be careful.
    // But standard LangCache URL is usually the host.
    // Let's assume serverURL is the host.
    
    const url = `${baseUrl}/v1/caches/${cacheId}/entries/${entryId}`;

    const res = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${apiKey}`
        }
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to delete entry ${entryId}: ${res.status} ${txt}`);
    }
}

async function searchEntry<T>(key: string) {
  if (!langCache) return null;
  try {
    const match = await findEntryByPrompt(key);

    if (!match) return null;
    return {
      id: match.id,
      data: JSON.parse(match.response) as StoredCacheRecord<unknown>
    };
  } catch (error) {
    console.error("[langcache] searchEntry failed", error);
    return null;
  }
}

export function isLangCacheEnabled() {
  return Boolean(langCache);
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number) {
  if (!langCache) return;
  
  // Ensure we don't have duplicates and overwrite existing
  try {
    const existing = await findEntryByPrompt(key);
    if (existing) {
        await deleteEntryById(existing.id);
    }
  } catch (error) {
    console.warn("[langcache] delete existing failed", error);
  }

  try {
    const payload: StoredCacheRecord<T> = { value };
    await langCache.set({
      prompt: key,
      response: JSON.stringify(payload),
      ttlMillis: ttlSeconds ? ttlSeconds * 1000 : undefined
    });
  } catch (error) {
    console.error("[langcache] cacheSet failed", error);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = await searchEntry<T>(key);
  if (!entry?.data) return null;
  const record = entry.data as StoredCacheRecord<T>;
  return record.value ?? null;
}

export async function cacheDelete(key: string) {
  if (!langCache) return;
  try {
    const existing = await findEntryByPrompt(key);
    if (existing) {
        await deleteEntryById(existing.id);
    }
  } catch (error) {
    console.error("[langcache] cacheDelete failed", error);
  }
}

const RATE_LIMIT_KEY_PREFIX = "ia-console:v2:ratelimit";
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.IA_CONSOLE_V2_RATE_LIMIT ?? 5
);

type RateLimitState = {
  remaining: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export async function consumeRateLimit(userId: string): Promise<RateLimitResult> {
  if (!langCache) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetAt: Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000
    };
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}:${userId}`;
  const now = Date.now();
  const state = await cacheGet<RateLimitState>(key);

  if (!state || state.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_SECONDS * 1000;
    const nextState: RateLimitState = {
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt
    };
    await cacheSet(key, nextState, RATE_LIMIT_WINDOW_SECONDS);
    return {
      allowed: true,
      remaining: nextState.remaining,
      resetAt
    };
  }

  if (state.remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: state.resetAt
    };
  }

  const nextState: RateLimitState = {
    remaining: state.remaining - 1,
    resetAt: state.resetAt
  };
  const ttlSeconds = Math.max(
    1,
    Math.ceil((state.resetAt - now) / 1000)
  );
  await cacheSet(key, nextState, ttlSeconds);
  return {
    allowed: true,
    remaining: nextState.remaining,
    resetAt: nextState.resetAt
  };
}
