/**
 * Shared JSON parser for AI module responses.
 * Uses balanced-brace matching instead of brittle regex.
 */

export function parseJsonResponse<T>(text: string): T {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON found in AI response');

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('Unbalanced JSON braces in AI response');

  const cleanedJson = text
    .substring(start, end + 1)
    .replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n' || char === '\r' || char === '\t') return ' ';
      return '';
    })
    .replace(/\s+/g, ' ');

  return JSON.parse(cleanedJson) as T;
}
