// ============================================================================
// Canonical El Niño land impacts, mapped to countries (NOAA/IRI consensus).
// Every country either gets a documented category or the honest default:
// "no strong, consistent effect" — nothing left unanswered.
// ============================================================================

export type ImpactCategory = "drought" | "flood" | "wetter" | "muted";

export interface ImpactInfo {
  category: ImpactCategory;
  phrase: string;
}

export const CATEGORY_META: Record<ImpactCategory, { label: string; fill: string; opacity: number }> = {
  drought: { label: "Drier than usual", fill: "#DC2626", opacity: 0.26 },
  flood:   { label: "Flooding risk", fill: "#1D4ED8", opacity: 0.40 },
  wetter:  { label: "Wetter than usual", fill: "#60A5FA", opacity: 0.32 },
  muted:   { label: "Little change expected", fill: "#F3F4F6", opacity: 1 },
};

export const DEFAULT_IMPACT: ImpactInfo = {
  category: "muted",
  phrase: "No strong, consistent effect documented — conditions vary from year to year.",
};

// ISO 3166-1 numeric (padded to 3 digits) -> impact
export const IMPACTS: Record<string, ImpactInfo> = {
  // --- drier ---
  "036": { category: "drought", phrase: "Drier than usual — drought risk peaks September–November." },
  "360": { category: "drought", phrase: "Drier than usual — fires and crop stress risk in spring." },
  "598": { category: "drought", phrase: "Drier than usual — fire risk elevated in September–October." },
  "356": { category: "drought", phrase: "Drier than usual — monsoon weaker than normal, heat stress." },
  "320": { category: "drought", phrase: "Drier than usual — dry spell January–April, crop stress." },
  "340": { category: "drought", phrase: "Drier than usual — dry spell January–April." },
  "558": { category: "drought", phrase: "Drier than usual — dry spell January–April." },
  "222": { category: "drought", phrase: "Drier than usual — dry spell January–April." },
  "710": { category: "drought", phrase: "Drier and hotter than usual — summer rainfall deficits." },
  "716": { category: "drought", phrase: "Drier than usual — harvest failures a known risk." },
  "508": { category: "drought", phrase: "Drier than usual — flood and rain deficits inland." },
  "894": { category: "drought", phrase: "Drier than usual — dry spells October–December." },
  "072": { category: "drought", phrase: "Drier than usual — below-normal rainfall, crop stress." },
  "516": { category: "drought", phrase: "Drier than usual — harsh, dry summer expected." },
  "170": { category: "drought", phrase: "Drier than usual — dry season lengthens." },
  "862": { category: "drought", phrase: "Drier than usual — dry season lengthens." },
  "328": { category: "drought", phrase: "Drier than usual — weak rainfall December–March." },
  "740": { category: "drought", phrase: "Drier than usual — weak rainfall December–March." },
  "608": { category: "drought", phrase: "Drier than usual — dry spell September–November." },
  // --- flooding ---
  "604": { category: "flood", phrase: "Heavy rain and flooding risk — worst in December–February, fisheries disrupted." },
  "218": { category: "flood", phrase: "Heavy rain and flooding risk — worst in December–February." },
  // --- wetter ---
  "404": { category: "wetter", phrase: "Above-normal rainfall — October–December." },
  "706": { category: "wetter", phrase: "Above-normal rainfall — October–December." },
  "231": { category: "wetter", phrase: "Above-normal rainfall — October–December." },
  "834": { category: "wetter", phrase: "Above-normal rainfall — October–December." },
  "800": { category: "wetter", phrase: "Above-normal rainfall — October–December." },
  "858": { category: "wetter", phrase: "Above-normal rainfall — November–February." },
  "600": { category: "wetter", phrase: "Above-normal rainfall — November–February." },
  "032": { category: "wetter", phrase: "Above-normal rainfall — November–February in the north." },
  "152": { category: "wetter", phrase: "Wetter in spring; drier in summer in the far south." },
  "840": { category: "wetter", phrase: "South wetter than usual; north milder winters, less snow." },
  "484": { category: "wetter", phrase: "North wetter than usual; south drier." },
  // --- modest / mixed (explicit, still "muted" color) ---
  "276": { category: "muted", phrase: "Weak, inconsistent signal — winters occasionally milder." },
  "250": { category: "muted", phrase: "Weak, inconsistent signal — winters occasionally milder." },
  "826": { category: "muted", phrase: "Weak, inconsistent signal — winters occasionally milder." },
  "724": { category: "muted", phrase: "Weak, inconsistent signal — winters wetter in the southwest." },
  "380": { category: "muted", phrase: "Weak, inconsistent signal — winters occasionally milder." },
  "392": { category: "muted", phrase: "Milder winters on average; snow seasons often weaker." },
  "410": { category: "muted", phrase: "Milder winters on average." },
  "124": { category: "muted", phrase: "Milder winters on average; otherwise little consistent change." },
  "156": { category: "muted", phrase: "Weak, inconsistent signal — modified monsoon behavior." },
  "076": { category: "muted", phrase: "North drier than usual, south wetter — mixed pattern." },
  "643": { category: "muted", phrase: "Little consistent change; some winters milder in the west." },
};

export function impactFor(id: string | number | undefined): ImpactInfo {
  if (id === undefined) return DEFAULT_IMPACT;
  return IMPACTS[String(id).padStart(3, "0")] || DEFAULT_IMPACT;
}
