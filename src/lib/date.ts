const FR_DATE_FORMATTER = new Intl.DateTimeFormat("fr-BE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const dt = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function fromTimestampString(value: string): Date | null {
  if (!/^\d{10,13}$/.test(value)) return null;
  const raw = Number(value);
  if (Number.isNaN(raw)) return null;
  const ms = value.length === 10 ? raw * 1000 : raw;
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function formatDateFR(input: string | Date | null | undefined): string {
  if (input == null) return "";

  let date: Date | null = null;

  if (input instanceof Date) {
    date = Number.isNaN(input.getTime()) ? null : input;
  } else if (typeof input === "string") {
    const value = input.trim();
    if (!value) return "";
    date = fromIsoDate(value) ?? fromTimestampString(value);
    if (!date) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
    if (!date) return value;
  }

  if (!date) return "";
  return FR_DATE_FORMATTER.format(date);
}
