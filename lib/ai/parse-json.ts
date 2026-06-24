/**
 * Shared JSON parser for AI module responses.
 * Uses balanced-brace matching with string-awareness to avoid
 * miscounting braces inside quoted string values.
 */

export function parseJsonResponse<T>(text: string): T {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON found in AI response');

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  let jsonStr: string;
  if (end === -1) {
    // Truncated response — attempt repair by closing open braces/brackets
    jsonStr = text.substring(start);
    let repairDepth = 0;
    let repairInStr = false;
    let repairEsc = false;
    const openStack: string[] = [];
    for (let i = 0; i < jsonStr.length; i++) {
      const c = jsonStr[i];
      if (repairEsc) { repairEsc = false; continue; }
      if (c === '\\' && repairInStr) { repairEsc = true; continue; }
      if (c === '"') { repairInStr = !repairInStr; continue; }
      if (repairInStr) continue;
      if (c === '{') openStack.push('}');
      else if (c === '[') openStack.push(']');
      else if (c === '}' || c === ']') openStack.pop();
    }
    // If we're inside a string, close it first
    if (repairInStr) jsonStr += '"';
    // Close all open brackets/braces
    while (openStack.length > 0) jsonStr += openStack.pop();
  } else {
    jsonStr = text.substring(start, end + 1);
  }

  const cleanedJson = jsonStr
    .replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n' || char === '\r' || char === '\t') return ' ';
      return '';
    })
    .replace(/\s+/g, ' ');

  return JSON.parse(cleanedJson) as T;
}
