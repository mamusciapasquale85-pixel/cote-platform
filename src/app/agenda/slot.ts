export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SlotLabel = `P${SlotNumber}`;

export const SLOTS: SlotNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function normalizeSlotLabel(raw: string): SlotLabel | null {
  const value = raw.trim().toUpperCase();
  if (!value) return null;

  const match = /^P?(10|[1-9])$/.exec(value);
  if (!match) return null;

  const n = Number(match[1]);
  if (n < 1 || n > 10) return null;
  return `P${n}` as SlotLabel;
}

export function parseSlotRaw(raw: string): SlotNumber | null {
  const normalized = normalizeSlotLabel(raw);
  if (!normalized) return null;
  return Number(normalized.slice(1)) as SlotNumber;
}

export function parseSlotValue(raw: unknown): SlotNumber | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isInteger(raw)) return parseSlotRaw(String(raw));
  if (typeof raw === "string") return parseSlotRaw(raw);
  return null;
}

export function toSlotLabel(slot: SlotNumber): SlotLabel {
  return `P${slot}`;
}
