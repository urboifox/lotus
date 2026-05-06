const STORAGE_PREFIX = "hieroglyph_export_count:";

export function getUserEmailFromStorage(): string {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "anonymous";
    const u = JSON.parse(raw) as {
      email?: string;
      username?: string;
      user_name?: string;
    };
    return u.email ?? u.username ?? u.user_name ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

export function exportUsageStorageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.toLowerCase()}`;
}

export function getStoredExportCount(email: string): number {
  const key = exportUsageStorageKey(email);
  const raw = localStorage.getItem(key);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function incrementStoredExportCount(email: string): void {
  const key = exportUsageStorageKey(email);
  const next = getStoredExportCount(email) + 1;
  localStorage.setItem(key, String(next));
}

export function clearStoredExportCount(email: string): void {
  localStorage.removeItem(exportUsageStorageKey(email));
}
