/**
 * DART (Korea) stub. Disclosure list against the DART OpenAPI. Requires
 * DART_API_KEY (free). The document endpoint returns a zip of XML; unzip and
 * Korean-language extraction are not wired. No cron.
 */
import { fetchWithTimeout } from '../../fetch-with-timeout';

const BASE = 'https://opendart.fss.or.kr/api';

export interface DartDisclosure {
  rcept_no: string;
  corp_name: string;
  report_nm: string;
  rcept_dt: string; // YYYYMMDD
  viewerUrl: string;
}

/** Disclosures in a window whose title mentions licensing or technology transfer. Returns [] without a key. */
export async function listDartDisclosures(fromYyyymmdd: string, toYyyymmdd: string): Promise<DartDisclosure[]> {
  const key = process.env.DART_API_KEY;
  if (!key) return [];
  const res = await fetchWithTimeout(`${BASE}/list.json?crtfc_key=${key}&bgn_de=${fromYyyymmdd}&end_de=${toYyyymmdd}&pblntf_ty=I&page_count=100`, { timeoutMs: 20_000, retries: 1 });
  if (!res.ok) return [];
  const data = await res.json() as { list?: Array<Record<string, string>> };
  return (data.list ?? [])
    .filter(r => /기술이전|기술도입|라이선스|license|공동개발/i.test(r.report_nm ?? ''))
    .map(r => ({ rcept_no: r.rcept_no, corp_name: r.corp_name, report_nm: r.report_nm, rcept_dt: r.rcept_dt, viewerUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}` }));
}
