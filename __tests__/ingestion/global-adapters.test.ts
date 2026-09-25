import { parseMfnFeed, isMfnDealItem } from '@/lib/ingestion/exchanges/mfn';
import { isCninfoDealTitle } from '@/lib/ingestion/exchanges/cninfo';
import { isDartDealReport } from '@/lib/ingestion/exchanges/dart';

describe('MFN feed', () => {
  const xml = `<rss><channel>
<item><title><![CDATA[Nanexa and Novo enter into EUR 1.165 billion global license agreement]]></title><link>https://mfn.se/one/a/nanexa/x-1</link><guid>https://mfn.se/one/a/nanexa/x-1</guid><pubDate>Fri, 25 Sep 2026 06:00:00 +0000</pubDate><description><![CDATA[<p>Nanexa AB today announced an exclusive license with Novo Nordisk for its PharmaShell technology...</p>]]></description></item>
<item><title>ABIVAX: Nombre d’actions composant le capital social</title><link>https://mfn.se/eqs/a/abivax/y-2</link><pubDate>Fri, 25 Sep 2026 16:00:03 +0000</pubDate><description>monthly</description></item>
</channel></rss>`;
  it('parses items with date and stripped description', () => {
    const items = parseMfnFeed(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain('Nanexa and Novo');
    expect(items[0].dateIso).toBe('2026-09-25');
    expect(items[0].description).toContain('exclusive license with Novo Nordisk');
  });
  it('keeps the licence, drops the share-count notice', () => {
    const items = parseMfnFeed(xml);
    expect(isMfnDealItem(items[0].title, items[0].description)).toBe(true);
    expect(isMfnDealItem(items[1].title, items[1].description)).toBe(false);
  });
  it('drops a non-pharma partnership', () => {
    expect(isMfnDealItem('Elliptic Labs signs contract expansion with existing customer', 'AI virtual sensors')).toBe(false);
  });
});

describe('cninfo title filter', () => {
  it('keeps mainland pharma licence announcements', () => {
    expect(isCninfoDealTitle('诺诚健华医药有限公司关于子公司与礼来公司签署研发合作及授权许可协议的公告', '诺诚健华')).toBe(true);
    expect(isCninfoDealTitle('复星医药关于控股子公司签订合作与许可协议的公告', '复星医药')).toBe(true);
  });
  it('drops terminations and non-pharma licences', () => {
    expect(isCninfoDealTitle('关于终止《战略合作协议之授权许可协议》的公告', '昂利康')).toBe(false);
    expect(isCninfoDealTitle('关于与宝马汽车公司签署自动驾驶地图许可协议的公告', '四维图新')).toBe(false);
  });
});

describe('DART report filter', () => {
  it('keeps technology transfer and licence reports from pharma issuers', () => {
    expect(isDartDealReport('기타 경영사항(자율공시)(기술이전계약 체결)', '한미약품')).toBe(true);
    expect(isDartDealReport('투자판단관련주요경영사항(라이선스 계약 체결)', '알테오젠')).toBe(true);
  });
  it('drops corrections, terminations and non-pharma issuers', () => {
    expect(isDartDealReport('[정정신고]기술이전계약 체결', '한미약품')).toBe(false);
    expect(isDartDealReport('기술이전계약 해지', '유한양행')).toBe(false);
    expect(isDartDealReport('기술도입계약 체결', '현대자동차')).toBe(false);
  });
});
