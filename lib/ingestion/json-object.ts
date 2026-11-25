/**
 * Reading the JSON object out of an extractor reply, shared by the filing extractor
 * (sec-edgar.ts) and newswire extraction (press-releases.ts). No imports, so either
 * module can use it without a cycle.
 */

/** The reply could not be read as JSON. Not a verdict: the caller retries the document. */
export class ExtractionParseError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ExtractionParseError'; }
}

/**
 * The first complete top-level JSON object in a model reply. The old greedy /\{[\s\S]*\}/
 * swallowed trailing notes that contained braces, or a second object, and JSON.parse failed.
 */
export function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}
