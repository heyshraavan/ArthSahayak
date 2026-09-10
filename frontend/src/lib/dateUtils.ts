/**
 * Date normalization and validation utility for ArthSahayak.
 *
 * Enforces canonical 'YYYY-MM-DD' ISO date strings across OCR extraction,
 * human review, and local IndexedDB ledger persistence.
 *
 * Invariants:
 * - Does not silently invent dates when ambiguous or unparseable.
 * - Supports common Indian commercial formats:
 *   - YYYY-MM-DD
 *   - DD-MM-YYYY
 *   - DD/MM/YYYY
 *   - DD.MM.YYYY
 * - Strict calendar validation (verifies leap years, days per month).
 * - Ambiguous (e.g. 2-digit years) or invalid dates return null so they can be
 *   surfaced for explicit human correction before ledger confirmation.
 */

/**
 * Normalizes an arbitrary date input into a canonical 'YYYY-MM-DD' string.
 * Returns null if the date is invalid, ambiguous, or unparseable.
 */
export function normalizeDateString(rawDate: unknown): string | null {
  if (rawDate === null || rawDate === undefined) {
    return null;
  }

  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return null;
    return rawDate.toISOString().split('T')[0];
  }

  if (typeof rawDate !== 'string') {
    return null;
  }

  const trimmed = rawDate.trim();
  if (!trimmed) {
    return null;
  }

  // Strip timestamp component if present (e.g. "2007-05-22T00:00:00" or "2007-05-22 14:30")
  const datePart = trimmed.split(/[T ]/)[0].trim();

  // Pattern 1: YYYY[-/. ]MM[-/. ]DD
  const isoMatch = /^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/.exec(datePart);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateAndFormatDate(year, month, day);
  }

  // Pattern 2: DD[-/. ]MM[-/. ]YYYY
  const dmyMatch = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/.exec(datePart);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    return validateAndFormatDate(year, month, day);
  }

  // Non-matching, 2-digit year, or ambiguous format: do not invent, return null
  return null;
}

/**
 * Validates calendar correctness in UTC and produces 'YYYY-MM-DD'.
 */
function validateAndFormatDate(year: number, month: number, day: number): string | null {
  // Enforce reasonable calendar year range
  if (year < 1900 || year > 2100) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > 31) {
    return null;
  }

  // Construct UTC date to verify day is valid for month/year (handles Feb 28/29, 30-day months)
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
