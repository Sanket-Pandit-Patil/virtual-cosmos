const PRESET_RE = /^\/avatars\/preset-[1-6]\.svg$/i;

export const AVATAR_PRESETS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
  "/avatars/preset-6.svg",
] as const;

/** Client rule: presets under /avatars/ or https URL on the current page origin. */
export function isClientAvatarUrlAllowed(url: string, pageOrigin: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (PRESET_RE.test(u)) return true;
  try {
    const p = new URL(u);
    return p.origin === pageOrigin;
  } catch {
    return false;
  }
}

/** Resolve relative preset paths to absolute for Pixi/network loaders. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  if (u.startsWith("https://") || u.startsWith("http://")) return u;
  if (u.startsWith("/")) return `${window.location.origin}${u}`;
  return null;
}

