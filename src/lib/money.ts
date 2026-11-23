// Decimal-safe helpers for money strings like "25440.00". Uses BigInt scaled integers, never float sums.
const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

export function toScaled(value: string | number | null | undefined): bigint {
  const s = String(value ?? "0").trim() || "0";
  const neg = s.startsWith("-");
  const [intPart = "0", frac = ""] = s.replace(/^[-+]/, "").split(".");
  const fracPadded = (frac + "0".repeat(SCALE)).slice(0, SCALE);
  const n = BigInt(intPart || "0") * FACTOR + BigInt(fracPadded || "0");
  return neg ? -n : n;
}

export function fromScaled(n: bigint, decimals = 2): string {
  const neg = n < 0n;
  let abs = neg ? -n : n;
  const drop = 10n ** BigInt(SCALE - decimals);
  abs = (abs + drop / 2n) / drop; // round half up
  const base = 10n ** BigInt(decimals);
  const int = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0");
  return `${neg ? "-" : ""}${int}${decimals ? "." + frac : ""}`;
}

export const addMoney = (...v: (string | number)[]) => fromScaled(v.reduce<bigint>((a, b) => a + toScaled(b), 0n));
export const subMoney = (a: string, b: string) => fromScaled(toScaled(a) - toScaled(b));

/** Preview only: qty x rate x (1 - disc%). Saved values always come from the API. */
export function previewLineAmount(qty: string, rate: string, discPct = "0"): string {
  const gross = (toScaled(qty) * toScaled(rate)) / FACTOR;
  const disc = (gross * toScaled(discPct)) / (FACTOR * 100n);
  return fromScaled(gross - disc);
}

function groupIndian(int: string): string {
  if (int.length <= 3) return int;
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** "184500.00" -> "৳ 1,84,500" (decimals shown only when non-zero unless forced). */
export function formatBDT(value: string | number | null | undefined, opts: { decimals?: boolean } = {}): string {
  const fixed = fromScaled(toScaled(value));
  const neg = fixed.startsWith("-");
  const [int = "0", frac = "00"] = fixed.replace("-", "").split(".");
  const showFrac = opts.decimals ?? frac !== "00";
  return `${neg ? "-" : ""}৳ ${groupIndian(int)}${showFrac ? "." + frac : ""}`;
}

export function formatQty(value: string | null | undefined, unit?: string): string {
  const fixed = fromScaled(toScaled(value), 3).replace(/\.?0+$/, "");
  const [int = "0", frac] = fixed.replace("-", "").split(".");
  const s = `${fixed.startsWith("-") ? "-" : ""}${groupIndian(int)}${frac ? "." + frac : ""}`;
  return unit ? `${s} ${unit}` : s;
}

/** Quantity sum with 3 decimals, e.g. addQty("50.000", "-5") -> "45.000". */
export const addQty = (...v: (string | number)[]) => fromScaled(v.reduce<bigint>((a, b) => a + toScaled(b), 0n), 3);
/** qty x price rounded to 2 decimals (stock value). */
export const mulMoney = (qty: string, price: string) => fromScaled((toScaled(qty) * toScaled(price)) / FACTOR);

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r]! : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}
function intWords(n: bigint): string {
  if (n === 0n) return "Zero";
  const parts: string[] = [];
  const crore = n / 10_000_000n; n %= 10_000_000n;
  if (crore) parts.push(`${intWords(crore)} Crore`);
  const lakh = Number(n / 100_000n); n %= 100_000n;
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  const thousand = Number(n / 1000n); n %= 1000n;
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(Number(n)));
  return parts.join(" ");
}
/** "35000.50" -> "Taka Thirty Five Thousand and Fifty Paisa Only" (Bangladeshi lakh/crore grouping). */
export function amountInWords(value: string): string {
  const [int = "0", frac = "00"] = fromScaled(toScaled(value)).replace("-", "").split(".");
  const paisa = Number(frac);
  return `Taka ${intWords(BigInt(int))}${paisa ? ` and ${below1000(paisa)} Paisa` : ""} Only`;
}
