/**
 * Score archive entries for MCP tool calls (enterprise API, /api/mcp).
 *
 * Every tool that computes a valuation, score or forecast is archived with
 * origin 'api'. The caller's parameters describe their own asset, so they
 * are kept as a hash plus the coarse profile. Pure lookups of historical
 * data (comparables, market calendar, deal database) are not scores and
 * are skipped.
 */

import type { ScoreArchiveEntry } from './index';
import { sha256Hex } from './index';

/** MCP server engine_version (app/api/mcp/route.ts getResponseMeta). */
export const MCP_ENGINE_VERSION = '2.0.0';

/** Tools that return stored history rather than a computed score. */
export const MCP_LOOKUP_TOOLS: ReadonlySet<string> = new Set([
  'get_comparable_deals',
  'get_market_intelligence',
  'query_deal_database',
]);

/** Largest tool response text kept verbatim; larger ones keep only the hash. */
const MAX_TEXT_CHARS = 48_000;

function pick(params: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = params[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

export function mcpArchiveEntry(toolName: string, params: unknown, result: unknown): ScoreArchiveEntry | null {
  if (MCP_LOOKUP_TOOLS.has(toolName)) return null;
  const r = result as { content?: Array<{ type?: string; text?: string }>; isError?: boolean } | null;
  if (!r || r.isError) return null;
  const text = (r.content ?? []).filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n');
  if (!text) return null;

  const p = (params && typeof params === 'object' ? params : {}) as Record<string, unknown>;
  return {
    product: 'solidus',
    scoreType: `mcp.${toolName}`,
    modelVersion: `mcp-${MCP_ENGINE_VERSION}`,
    origin: 'api',
    entityType: 'profile',
    therapeuticArea: pick(p, 'therapeuticArea', 'therapeutic_area'),
    phase: pick(p, 'phase', 'development_phase'),
    modality: pick(p, 'modality'),
    indication: pick(p, 'indication'),
    confidential: true,
    inputs: p,
    output: text.length <= MAX_TEXT_CHARS
      ? { text_sha256: sha256Hex(text), text }
      : { text_sha256: sha256Hex(text), text_chars: text.length, truncated: true, head: text.slice(0, 4000) },
  };
}
