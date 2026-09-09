/**
 * Iranian Registry of Clinical Trials (IRCT) adapter.
 *
 * Endpoint  GET https://en.irct.ir/trial/{n}/xml   (n = internal numeric id, sequential;
 *           ~80,000 by Sep 2026). Returns the WHO ICTRP XML export for one trial:
 *           <trials><trial><main>{trial_id IRCT2023…N1, utrn, reg_name, date_registration,
 *           primary_sponsor, public_title, scientific_title, date_enrolment, target_size,
 *           recruitment_status, url, study_type, study_design, phase, hc_freetext, i_freetext,
 *           results_*}</main><contacts/><countries><country2/></countries><criteria/>
 *           <health_condition_code><hc_code/></…><health_condition_keyword><hc_keyword/>…
 *           <intervention_code><i_code/>…<intervention_keyword><i_keyword/>…
 *           <primary_outcome/><secondary_outcome/><secondary_sponsor><sponsor_name/>…
 *           <secondary_ids><secondary_id><sec_id/><issuing_authority/>…<source_support><source_name/>…
 *           Verified Sep 2026 from a US egress (the newer irct.behdasht.gov.ir host times out
 *           from the US; en.irct.ir answers). Unknown ids return 404.
 *           Search page: https://en.irct.ir/search/result?query=… (HTML, lists /trial/{n}).
 *           There is no documented bulk export (the "how to export" page is Farsi-only), so
 *           the sweep walks the numeric id space with a miss-streak stop.
 * Auth      none.  Rate  we use 500 ms between requests.
 * License   IRCT terms of use — data are publicly available for research and
 *           non-commercial-redistribution; commercial reuse is not addressed.
 *           Store only the fields needed and keep source_url attribution.
 * Reach     ~80,000 trials; industry-sponsored drug trials are a small minority
 *           (a few hundred, mostly Iranian biosimilar/generic sponsors: CinnaGen, AryoGen,
 *           Actoverco, Zistdaru Danesh, Orchid Pharmed).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord } from './types';
import { mapIctrpXml, registryFetch, sleep } from './shared';

const BASE = () => process.env.IRCT_BASE_URL ?? 'https://en.irct.ir';
const DEFAULT_START_ID = 60_000; // trials registered from ~2022 onward
const MISS_STREAK_STOP = 40;

export interface IrctRaw {
  internalId: number;
  xml: string;
}

export function mapIrctXml(raw: IrctRaw): RegistryRecord {
  const rec = mapIctrpXml(raw.xml, {
    registry: 'irct',
    defaultCountries: ['IR'],
    detailUrl: id => `${BASE()}/trial/${raw.internalId}`,
  });
  rec.source_url = `${BASE()}/trial/${raw.internalId}`;
  rec.raw = { ...(rec.raw as Record<string, unknown>), internal_id: raw.internalId };
  return rec;
}

interface IrctCursor {
  nextId: number;
  missStreak: number;
}

function parseCursor(cursor: string | null): IrctCursor {
  if (!cursor) return { nextId: DEFAULT_START_ID, missStreak: 0 };
  try {
    const c = JSON.parse(cursor) as Partial<IrctCursor>;
    return { nextId: Math.max(1, Number(c.nextId) || DEFAULT_START_ID), missStreak: Number(c.missStreak) || 0 };
  } catch {
    const n = Number(cursor);
    return { nextId: Number.isFinite(n) && n > 0 ? n : DEFAULT_START_ID, missStreak: 0 };
  }
}

export const irctAdapter: RegistryAdapter<IrctRaw> = {
  registry: 'irct',
  displayName: 'Iranian Registry of Clinical Trials',
  countryScope: ['IR'],
  license: 'IRCT public data; attribution required, commercial redistribution not addressed',
  capability: 'api',
  transport: 'xml',
  verified: 'verified',
  rateLimitMs: 500,
  defaultLimit: 40,
  estimatedReach: 80_000,
  urls: {
    search: 'https://en.irct.ir/search/result?query=',
    detail: id => `https://en.irct.ir/search/result?query=${encodeURIComponent(id)}`,
  },

  mapRecord(raw: IrctRaw): RegistryRecord {
    return mapIrctXml(raw);
  },

  /**
   * Cursor: {"nextId":n,"missStreak":k}. Walks internal ids upward; a run of
   * 40 consecutive 404s means the end of the registry has been reached
   * (done=true, cursor rewinds to the first miss so new registrations are
   * picked up next run).
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const c = parseCursor(cursor);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 200);
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    let id = c.nextId;
    let missStreak = c.missStreak;
    let firstMiss: number | null = null;
    for (let i = 0; i < limit; i++, id++) {
      if (opts.signal?.aborted) break;
      try {
        const res = await registryFetch(`${BASE()}/trial/${id}/xml`, { signal: opts.signal, timeoutMs: 20_000, retries: 0, headers: { Accept: 'text/xml' } });
        if (res.status === 404) {
          missStreak++;
          if (firstMiss === null) firstMiss = id;
        } else if (!res.ok) {
          warnings.push(`IRCT ${id}: HTTP ${res.status}`);
        } else {
          const xml = await res.text();
          if (/<trial_id>\s*IRCT/i.test(xml)) {
            missStreak = 0;
            firstMiss = null;
            records.push(mapIrctXml({ internalId: id, xml }));
          } else {
            missStreak++;
            if (firstMiss === null) firstMiss = id;
          }
        }
      } catch (err) {
        warnings.push(`IRCT ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (missStreak >= MISS_STREAK_STOP) {
        return {
          records,
          nextCursor: JSON.stringify({ nextId: firstMiss ?? id, missStreak: 0 } satisfies IrctCursor),
          done: true,
          warnings,
        };
      }
      await sleep(this.rateLimitMs);
    }
    return { records, nextCursor: JSON.stringify({ nextId: id, missStreak } satisfies IrctCursor), done: false, warnings };
  },
};

export default irctAdapter;
