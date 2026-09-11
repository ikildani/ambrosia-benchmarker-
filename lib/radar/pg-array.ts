/**
 * Build a PostgreSQL array literal for PostgREST array operators.
 *
 * supabase-js serializes `.overlaps(col, string[])` as `{a,b}` without
 * quoting, so an element containing a comma, quote, brace or backslash
 * (e.g. "Anhui Zhifei Longcom Biologic Pharmacy Co., Ltd") produces a
 * malformed array literal and the whole query fails. Pass the result of
 * this helper instead of the raw array.
 */
export function pgArrayLiteral(values: readonly (string | null | undefined)[]): string {
  const quoted = values
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(v => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `{${quoted.join(',')}}`;
}
