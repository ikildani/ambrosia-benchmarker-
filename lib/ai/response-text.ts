/**
 * Reading model replies safely. Nov 23 2026.
 *
 * claude-sonnet-5 (the lean-mode deal extractor since Oct 29) and claude-opus-5
 * think by default when `thinking` is omitted, so the reply opens with a
 * `thinking` block and the JSON sits in a later `text` block. Code that read
 * `content[0]` and returned null when it was not text recorded those replies as
 * "not a deal": 4,606 paid extractions (Oct 29 to Nov 23, ~$97) inserted 2 rows.
 */

interface BlockLike { type: string; text?: string }

/** All text blocks of a reply, joined; '' when there are none. */
export function replyText(content: ReadonlyArray<BlockLike> | null | undefined): string {
  if (!content) return '';
  return content.filter(b => b.type === 'text' && typeof b.text === 'string').map(b => b.text as string).join('\n');
}

/**
 * Request fields that turn thinking off for JSON extraction, on models that accept
 * `{type: 'disabled'}` and would otherwise think by default (claude-sonnet-5,
 * claude-opus-5). Other models either do not think unless asked (opus-4.x,
 * sonnet-4.x, haiku-4.5) or reject `disabled` (opus-5-5, sonnet-5-5, fable), so
 * they get nothing; replyText() still reads their reply correctly.
 */
export function noThinking(model: string): { thinking?: { type: 'disabled' } } {
  return model === 'claude-sonnet-5' || model === 'claude-opus-5' ? { thinking: { type: 'disabled' } } : {};
}
