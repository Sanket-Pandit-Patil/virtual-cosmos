const MAX_LEN = 500;

const PRESET_RE = /^\/avatars\/preset-[1-6]\.svg$/i;

function allowedHttpsHosts(): Set<string> {
  const set = new Set<string>(["localhost", "127.0.0.1"]);
  const extra = process.env.AVATAR_ALLOWED_HOSTS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra?.length) {
    for (const h of extra) set.add(h);
  }
  const co = process.env.CLIENT_ORIGIN;
  if (typeof co === "string" && !co.includes(",")) {
    try {
      set.add(new URL(co).hostname);
    } catch {
      /* ignore */
    }
  }
  return set;
}

/** Preset paths or https URLs whose hostname is allowed (same deploy / env). */
export function sanitizeAvatarUrl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const u = raw.trim().slice(0, MAX_LEN);
  if (!u) return null;
  if (PRESET_RE.test(u)) return u;
  try {
    const parsed = new URL(u);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === "http:") {
      if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        return null;
      }
    } else if (parsed.protocol !== "https:") {
      return null;
    }
    const hosts = allowedHttpsHosts();
    if (!hosts.has(parsed.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}
