import { parseTdnetList, isTdnetDealTitle } from '@/lib/ingestion/exchanges/tdnet';

const row = (time: string, code: string, name: string, title: string, file: string) => `
<tr>
  <td class="oddnew-L kjTime">${time}</td>
  <td class="oddnew-M kjCode">${code}</td>
  <td class="oddnew-M kjName">${name}</td>
  <td class="oddnew-M kjTitle"><a href="${file}" target="_blank">${title}</a></td>
  <td class="oddnew-M kjXbrl"></td>
  <td class="oddnew-M kjPlace">東</td>
  <td class="oddnew-R kjHistroy"></td>
</tr>`;

const html = `
<table>
<tr><td class="header-L">時刻</td><td class="header-M">コード</td></tr>
${row('18:30', '45820', 'Ｇ－シンバイオ製薬', '多発性硬化症の独占的グローバルライセンスを取得 BCVに関する開発のライセンス契約締結', '140120260924539127.pdf')}
${row('15:00', '26520', 'まんだらけ', '株主優待制度の一部変更及び追加導入に関するお知らせ', '140120260925539965.pdf')}
${row('15:30', '520A0', 'Ｇ－ジェイファーマ', 'JPH034に関する、欧州バイオテック企業との非拘束的なライセンス契約骨子案締結のお知らせ', '140120260924539645.pdf')}
</table>
<a href="I_list_002_20260925.html">2</a> <a href="I_list_003_20260925.html">3</a>`;

describe('TDnet list parser', () => {
  it('parses rows with code, company, title, and absolute PDF url', () => {
    const { rows, pages } = parseTdnetList(html, '2026-09-25');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ code: '45820', company: 'Ｇ－シンバイオ製薬', fileId: '140120260924539127', dateIso: '2026-09-25', time: '18:30' });
    expect(rows[0].url).toBe('https://www.release.tdnet.info/inbs/140120260924539127.pdf');
    expect(rows[0].title).toContain('ライセンス契約締結');
    expect(pages).toEqual(['002', '003']);
  });
});

describe('TDnet deal-title filter', () => {
  it('keeps a pharma-sector licence disclosure', () => {
    expect(isTdnetDealTitle('BCVに関する開発のライセンス契約締結', '45820', 'シンバイオ製薬')).toBe(true);
  });
  it('keeps a non-45xx issuer when the title carries a life-science term', () => {
    expect(isTdnetDealTitle('欧州バイオテック企業との非拘束的なライセンス契約骨子案締結のお知らせ', '520A0', 'ジェイファーマ')).toBe(true);
  });
  it('drops shareholder-perk and stock-plan notices even with 導入', () => {
    expect(isTdnetDealTitle('株主優待制度の一部変更及び追加導入に関するお知らせ', '26520', 'まんだらけ')).toBe(false);
    expect(isTdnetDealTitle('譲渡制限付株式報酬制度の導入に関するお知らせ', '70970', 'さくらさく')).toBe(false);
  });
  it('drops a business alliance from a non-pharma issuer', () => {
    expect(isTdnetDealTitle('リードプラス株式会社との業務提携に関するお知らせ', '73570', 'ジオコード')).toBe(false);
  });
  it('drops regulatory approvals', () => {
    expect(isTdnetDealTitle('製造販売承認取得のお知らせ', '45190', '中外製薬')).toBe(false);
  });
});
