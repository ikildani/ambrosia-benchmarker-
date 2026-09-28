/**
 * CDE browser worker: page parsers (lib/ingestion/registries/browser/cde-pages.ts),
 * cursor + fetchPage against a fake session (cde-fetch.ts), and the mapper on
 * the 2026 detail layout. Fixtures are trimmed copies of real markup captured
 * Sep 28 2026.
 */

import { parseCdeListing, parseCdeDetail, cdeListingForm, cdeDetailForm, looksLikeCdeChallenge, drugNameFromCell } from '@/lib/ingestion/registries/browser/cde-pages';
import { createCdeFetchPage, parseCdeCursor, type CdeSession } from '@/lib/ingestion/registries/browser/cde-fetch';
import { mapCdePage } from '@/lib/ingestion/registries/cde';

const ROW = (ctr: string, id: string, n: number, status = '进行中&nbsp;尚未招募') => `
<tr style=" color:#535353"> <td height="40">&nbsp;${n}</td>
 <td> <a href="javascript:void(0)" onclick="getDetail(this.id)" id="${id}" name="${n}"> ${ctr} </a></td>
 <td> <a href="javascript:void(0)" onclick="getDetail(this.id)" id="${id}" name="${n}"> ${status} </a> </td>
 <td> <a href="javascript:void(0)" onclick="getDetail(this.id)" id="${id}" name="${n}"> SPGL008注射液 </a> </td>
 <td><a href="javascript:void(0)" onclick="getDetail(this.id)" id="${id}" name="${n}">晚期非小细胞肺癌</a></td>
 <td><a href="javascript:void(0)" onclick="getDetail(this.id)" id="${id}" name="${n}">SPGL008联合SSGJ-706±化疗治疗晚期非小细胞肺癌的II期临床研究</a></td> </tr>`;

const LISTING = `<html><body><form id="searchfrm" method="post" action="/clinicaltrials.searchlist.dhtml"><input type="hidden" id="currentpage" name="currentpage" value="1"></form>
<table><tr><th>序号</th><th>登记号</th><th>试验状态</th><th>药物名称</th><th>适应症</th><th>试验通俗题目</th></tr>
${ROW('CTR20263723', 'c6797632825d44d0aa82bff111d30748', 1)}
${ROW('CTR20263720', 'cc3cf50bf0a948e99df3e07d9d56547b', 2, '进行中&nbsp;招募中')}
</table><script>function getDetail(id){}</script></body></html>`;

const DETAIL = `<html><body><div class="panel-body"><table class="searchDetailTable">
<tr> <th width="15%">登记号</th> <td width="35%">CTR20263723</td> <th width="15%">试验状态</th> <td width="35%">进行中</td> </tr>
<tr> <th>申请人联系人</th> <td>贾海静</td> <th>首次公示信息日期</th> <td> 2026-09-24 </td> </tr>
<tr> <th>申请人名称</th> <td colspan="3"> 深圳赛保尔生物药业有限公司 </td> </tr></table>
<table class="searchDetailTable"><tr> <th>申请人名称</th> <td>1 2</td> </tr><tr> <th>联系人姓名</th> <td>贾海静</td> </tr></table>
<table class="searchDetailTable">
<tr> <th>药物名称</th> <td colspan="3"> SPGL008注射液 &nbsp;&nbsp;曾用名: </td> </tr>
<tr> <th>药物类型</th> <td colspan="3"> 生物制品 </td> </tr>
<tr> <th> 临床申请受理号 </th> <td colspan="3"> 企业选择不公示 </td> </tr>
<tr> <th>适应症</th> <td colspan="3">晚期非小细胞肺癌</td> </tr>
<tr> <th>试验专业题目</th> <td colspan="3">SPGL008联合SSGJ-706±化疗治疗晚期非小细胞肺癌的II期临床研究</td> </tr>
<tr> <th width="15%">试验分类</th> <td width="17%"> 安全性和有效性 </td> <th width="15%">试验分期</th> <td width="17%"> II期 </td> <th width="15%">设计类型</th> <td width="17%"> 平行分组 </td> </tr>
<tr> <th>随机化</th> <td> 非随机化 </td> <th>盲法</th> <td> 开放 </td> <th>试验范围</th> <td> 国内试验 </td> </tr>
<tr> <th width="15%">试验药</th> <td width="35%"> <table class="subSearch"> <tr> <th width="10%">序号</th> <th width="40%">名称</th> <th width="50%">用法</th> </tr>
 <tr> <td>1</td> <td>中文通用名:SPGL008注射液 英文通用名:SPGL008 商品名称:待定</td> <td>剂型:注射液<br>用法用量:静脉输注<br>用药时程:Q3W</td> </tr>
 <tr> <td>2</td> <td>中文通用名:SSGJ-706注射液 英文通用名:NA 商品名称:NA</td> <td>剂型:注射液</td> </tr>
 <tr> <td>3</td> <td>中文通用名:卡铂 英文通用名:Carboplatin 商品名称:波贝</td> <td>剂型:注射液</td> </tr> </table> </td> </tr>
<tr> <th width="15%">对照药</th> <td width="35%"> <table class="subSearch"> <tr> <th width="10%">序号</th> <th width="40%">名称</th> <th width="50%">用法</th> </tr> <tr> <td colspan="3">暂未填写此信息</td></tr> </table> </td> </tr>
<tr> <th>目标入组人数</th> <td> 国内: 220 ； </td> <th>已入组人数</th> <td> 国内: 登记人暂未填写该信息； </td> </tr>
<tr> <th>第一例受试者入组日期</th> <td> 国内：登记人暂未填写该信息； </td> <th>试验完成日期</th> <td> 国内：登记人暂未填写该信息； </td> </tr>
</table></div><script>var searchDetailTable=1;</script></body></html>`;

describe('CDE listing parser', () => {
  it('reads internal ids, ordinals, registration numbers and the recruitment sub-status', () => {
    const rows = parseCdeListing(LISTING);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'c6797632825d44d0aa82bff111d30748', index: '1', ctr: 'CTR20263723', status: '进行中 尚未招募', drug: 'SPGL008注射液', indication: '晚期非小细胞肺癌' });
    expect(rows[1].status).toBe('进行中 招募中');
    expect(rows[0].title).toMatch(/^SPGL008联合/);
  });

  it('builds the listing and detail forms the site expects', () => {
    expect(cdeListingForm(3)).toMatchObject({ currentpage: '3', rule: 'CTR', sort: 'desc', secondLevel: '0', id: '', ckm_index: '' });
    expect(cdeDetailForm({ id: 'abc', index: '7' }, 2)).toMatchObject({ id: 'abc', ckm_index: '7', currentpage: '2' });
  });

  it('picks the English generic name or code from a 名称 cell, else the Chinese name, never a brand', () => {
    expect(drugNameFromCell('中文通用名:SPGL008注射液 英文通用名:SPGL008 商品名称:待定')).toBe('SPGL008');
    expect(drugNameFromCell('中文通用名:克立硼罗软膏 英文通用名:Crisaborole Ointment 商品名称:Staquis&reg;/舒坦明&reg;')).toBe('Crisaborole Ointment');
    expect(drugNameFromCell('中文通用名:人凝血因子Ⅷ 英文通用名:NA 商品名称:无')).toBe('人凝血因子Ⅷ');
    expect(drugNameFromCell('暂未填写此信息')).toBeNull();
    expect(drugNameFromCell('Plain name')).toBe('Plain name');
  });

  it('recognises the WAF shell', () => {
    expect(looksLikeCdeChallenge('<html><head></head><body></body></html>')).toBe(true);
    expect(looksLikeCdeChallenge(LISTING)).toBe(false);
    expect(looksLikeCdeChallenge(DETAIL)).toBe(false);
  });
});

describe('CDE detail parser + mapper (2026 layout)', () => {
  const page = parseCdeDetail(DETAIL, 'https://www.chinadrugtrials.org.cn/x', { ctr: 'CTR20263723', status: '进行中 尚未招募' });

  it('pairs labels with values, drops unfilled placeholders, and reads the drug sub-tables', () => {
    expect(page.id).toBe('CTR20263723');
    expect(page.fields['申请人名称']).toBe('深圳赛保尔生物药业有限公司');
    expect(page.fields['药物名称']).toBe('SPGL008注射液');
    expect(page.fields['试验分期']).toBe('II期');
    expect(page.fields['试验药']).toEqual(['SPGL008', 'SSGJ-706注射液', 'Carboplatin']);
    expect(page.fields['对照药']).toEqual([]);
    expect(page.fields['临床申请受理号']).toBeUndefined();
    expect(page.fields['第一例受试者入组日期']).toBeUndefined();
    expect(page.fields['试验状态']).toBe('进行中 尚未招募');
    expect(page.fields['序号']).toBeUndefined();
  });

  it('maps to a registry record with sponsor, phase, status and experimental drugs', () => {
    const rec = mapCdePage(page);
    expect(rec.registry).toBe('cde');
    expect(rec.registry_id).toBe('CTR20263723');
    expect(rec.sponsor_name).toBe('深圳赛保尔生物药业有限公司');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.phase).toBe('phase_2');
    expect(rec.status).toBe('not_yet_recruiting');
    expect(rec.interventions.map(i => `${i.name}|${i.role}|${i.type}`)).toEqual(['SPGL008|experimental|biological', 'SSGJ-706注射液|experimental|biological', 'Carboplatin|experimental|biological']);
    expect(rec.conditions).toEqual(['晚期非小细胞肺癌']);
    expect(rec.first_registered).toBe('2026-09-24');
    expect(rec.start_date).toBeNull();
    expect(rec.countries).toEqual(['CN']);
  });
});

describe('CDE co-applicants', () => {
  it('takes the first applicant as sponsor and the rest as collaborators', () => {
    const html = DETAIL.replace('深圳赛保尔生物药业有限公司', 'AstraZeneca AB/ 阿斯利康全球研发（中国）有限公司/ AstraZeneca Nijmegen B.V.');
    const rec = mapCdePage(parseCdeDetail(html, 'u', { ctr: 'CTR20263723' }));
    expect(rec.sponsor_name).toBe('AstraZeneca AB');
    expect(rec.collaborators).toEqual(['阿斯利康全球研发（中国）有限公司', 'AstraZeneca Nijmegen B.V.']);
    expect(rec.sponsor_type).toBe('INDUSTRY');
  });
});

describe('CDE bioequivalence studies', () => {
  it('keeps generic BE studies out of the development phases', () => {
    const be = DETAIL
      .replace('试验分类</th> <td width="17%"> 安全性和有效性', '试验分类</th> <td width="17%"> 生物等效性')
      .replace(/SPGL008联合SSGJ-706±化疗治疗晚期非小细胞肺癌的II期临床研究/g, '评价恩曲替尼胶囊受试制剂与参比制剂在空腹条件下的生物等效性研究')
      .replace('II期', '其它');
    const rec = mapCdePage(parseCdeDetail(be, 'u', { ctr: 'CTR20263718', status: '进行中 尚未招募' }));
    expect(rec.phase).toBe('not_applicable');
    expect(rec.study_type).toBe('bioequivalence');
    expect(rec.phase_raw).toMatch(/bioequivalence/);
  });
});

describe('CDE fetchPage over a fake session', () => {
  const hexId = (ctr: string) => `${'0'.repeat(24)}${ctr.slice(-8)}`; // 32 hex chars, as the site's ids are
  function fakeSession(pages: Record<number, string[]>, opts: { challengeOnce?: boolean } = {}) {
    const calls: string[] = [];
    let challenged = false;
    const byId = new Map<string, string>();
    const session: CdeSession = {
      async post(path, form) {
        calls.push(`${path}?page=${form.currentpage}&id=${form.id}`);
        if (opts.challengeOnce && !challenged) { challenged = true; return { status: 200, text: '<html><head></head><body></body></html>' }; }
        if (path.endsWith('searchlist.dhtml')) {
          const ctrs = pages[Number(form.currentpage)] ?? [];
          for (const c of ctrs) byId.set(hexId(c), c);
          return { status: 200, text: `<table>${ctrs.map((c, i) => ROW(c, hexId(c), i + 1)).join('')}</table><script>function getDetail(id){}</script>` };
        }
        const ctr = byId.get(form.id) ?? 'CTR00000000';
        return { status: 200, text: DETAIL.replace(/CTR20263723/g, ctr) };
      },
      async refresh() { calls.push('refresh'); },
    };
    return { session, calls };
  }

  it('walks a page, caches its rows in the cursor, and continues from the cursor without re-listing', async () => {
    const { session, calls } = fakeSession({ 1: ['CTR20263723', 'CTR20263720', 'CTR20263719'] });
    const fetchPage = createCdeFetchPage(session, { rateLimitMs: 0, sleep: async () => undefined });
    const p1 = await fetchPage(null, { limit: 2 });
    expect(p1.records.map(r => r.registry_id)).toEqual(['CTR20263723', 'CTR20263720']);
    expect(p1.done).toBe(false);
    const c1 = JSON.parse(p1.nextCursor!);
    expect(c1).toMatchObject({ page: 1, idx: 2 });
    expect(c1.rows).toHaveLength(3);
    const p2 = await fetchPage(p1.nextCursor, { limit: 2 });
    expect(p2.records.map(r => r.registry_id)).toEqual(['CTR20263719']);
    expect(p2.done).toBe(true); // short page = last page
    expect(calls.filter(c => c.includes('searchlist.dhtml')).length).toBe(1);
  });

  it('refreshes the session once on a challenge shell and surfaces a persistent block as unavailable', async () => {
    const { session, calls } = fakeSession({ 1: ['CTR20263723'] }, { challengeOnce: true });
    const fetchPage = createCdeFetchPage(session, { rateLimitMs: 0, sleep: async () => undefined });
    const p = await fetchPage(null, { limit: 5 });
    expect(calls).toContain('refresh');
    expect(p.records).toHaveLength(1);
    const blocked: CdeSession = { async post() { return { status: 202, text: '<script>challenge</script>' }; }, async refresh() {} };
    await expect(createCdeFetchPage(blocked, { rateLimitMs: 0, sleep: async () => undefined })(null, { limit: 1 })).rejects.toThrow(/unavailable/);
  });

  it('ends an incremental sweep once a whole page is older than since', async () => {
    const { session } = fakeSession({ 1: Array.from({ length: 20 }, (_, i) => `CTR2026${String(3723 - i).padStart(4, '0')}`), 2: ['CTR20263000'] });
    const fetchPage = createCdeFetchPage(session, { rateLimitMs: 0, sleep: async () => undefined });
    const p = await fetchPage(null, { limit: 100, since: '2026-10-01' });
    expect(p.records).toHaveLength(20);
    expect(p.done).toBe(true);
  });

  it('restarts from page 1 on a foreign cursor', () => {
    expect(parseCdeCursor('{"kindIdx":1}', new Date('2026-09-28T00:00:00Z'))).toMatchObject({ page: 1, idx: 0 });
    expect(parseCdeCursor(null, new Date()).sweepStartedAt).toMatch(/^\d{4}-/);
  });
});
