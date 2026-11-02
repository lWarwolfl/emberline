export const saveKeys = ["economy", "coins", "loadout", "best", "muted", "effects"] as const;
export type SavePayload = Partial<Record<(typeof saveKeys)[number], string | null>>;
export interface CloudSave {
  userId?: string;
  data: SavePayload | null;
  version: number;
  updatedAt?: string;
}

export function sameSave(a: SavePayload, b: SavePayload) {
  return saveKeys.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

export function validSave(value: unknown): value is SavePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    Object.keys(data).every(
      (key) =>
        saveKeys.includes(key as (typeof saveKeys)[number]) &&
        (data[key] === null ||
          (typeof data[key] === "string" && (data[key] as string).length <= 50000)),
    ) && JSON.stringify(data).length <= 100000
  );
}
