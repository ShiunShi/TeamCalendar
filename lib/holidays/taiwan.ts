// Fetch Taiwan public-holiday dates for a given year from the
// ruyut/TaiwanCalendar jsDelivr mirror. Browser-only (uses fetch).
//
// API shape (one entry per day of the year):
//   { date: "20260101", week: "四", isHoliday: true, description: "開國紀念日" }

export interface TaiwanHoliday {
  date: Date;          // local-midnight Date
  description: string; // human-readable name, never empty
}

interface ApiEntry {
  date: string;
  isHoliday: boolean;
  description: string;
}

const SOURCE = "https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data";
const FALLBACK_TITLE = "Public holiday";

export async function fetchTaiwanHolidays(year: number): Promise<TaiwanHoliday[]> {
  let res: Response;
  try {
    res = await fetch(`${SOURCE}/${year}.json`);
  } catch {
    throw new Error("Couldn't reach the holiday data source. Try again.");
  }
  if (res.status === 404) {
    throw new Error(`Holiday data for ${year} is not available yet.`);
  }
  if (!res.ok) {
    throw new Error("Failed to fetch holiday data.");
  }
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error("Holiday data was in an unexpected format.");
  }
  const out: TaiwanHoliday[] = [];
  for (const entry of raw) {
    if (!isApiEntry(entry)) {
      throw new Error("Holiday data was in an unexpected format.");
    }
    if (!entry.isHoliday) continue;
    out.push({
      date: parseYyyymmdd(entry.date),
      description:
        entry.description.length > 0 ? entry.description : FALLBACK_TITLE,
    });
  }
  return out;
}

function isApiEntry(v: unknown): v is ApiEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.date === "string" &&
    e.date.length === 8 &&
    typeof e.isHoliday === "boolean" &&
    typeof e.description === "string"
  );
}

function parseYyyymmdd(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
