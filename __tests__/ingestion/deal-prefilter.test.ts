/**
 * Free pre-filter in front of deal extraction. Fixtures are real announcement titles:
 * deals that are in the deals table (verified/pending/flagged, by source), and titles the
 * extractor called "not a deal" (data_ingestion_log funnel examples, Sep 17 - Nov 23 2026).
 *
 * Measured on all of history (Nov 23 2026): 161 of 161 deal titles kept; 128 of 681
 * distinct not-a-deal titles dropped (DART 9/14, HKEX daily 10/21, HKEX backfill 72/341,
 * ASX 25/131, TDnet 4/11, CNINFO 7/143, MFN 1/13).
 */
import { prefilterDocument, screenBody, screenTitle } from '@/lib/ingestion/deal-prefilter';

const REAL_DEAL_TITLES = [
  // HKEX
  'INSIDE INFORMATION - ABBISKO REACHED A LICENSE AGREEMENT WITH MERCK FOR PIMICOTINIB (ABSK021)',
  'INSIDE INFORMATION - BEIGENE EXPANDS COLLABORATION WITH NOVARTIS',
  'CONNECTED TRANSACTION AND CONTINUING CONNECTED TRANSACTION IN RELATION TO LICENSE AND COLLABORATION AGREEMENT',
  'DISCLOSEABLE TRANSACTION - LICENSE AGREEMENT FOR GLOBAL DEVELOPMENT, MANUFACTURING AND COMMERCIALIZATION OF NOVEL BTK IN',
  'INSIDE INFORMATION - ENTRY INTO OF THE EXCLUSIVE OPTION AGREEMENT WITH TAKEDA INTERNATIONAL',
  'INSIDE INFORMATION - UPDATE ON THE LICENSE AND COMMERCIALIZATION AGREEMENT WITH COHERUS',
  'INSIDE INFORMATION ANNOUNCEMENT - LICENSE AND SUPPLY AGREEMENT WITH ORGANON FOR HLX11 (ANTI-HER2 DOMAIN II HUMANISED MON',
  'MAJOR TRANSACTION IN RELATION TO COLLABORATION AGREEMENT',
  'VOLUNTARY ANNOUNCEMENT - MEDIA REPORTS REGARDING LICENSE AGREEMENT ENTERED INTO BY A SUBSIDIARY',
  'VOLUNTARY ANNOUNCEMENT-EXCLUSIVE LICENSING AGREEMENT OF SIM0278 WITH ALMIRALL S.A. FOR RIGHTS OUTSIDE GREATER CHINA',
  'Licence Agreement with Kobayashi for the Commercial Launch of Fortacin in Japan',
  // ASX
  'Binding LOI for proposed acquisition of Galidesivir',
  'CSL Behring Acquires US Biotech Company Calimmune',
  'Grunenthal and MSB Enter Strategic Partnership for Back Pain',
  'Licence Agreement - Next Generation mRNA Vaccine Technology',
  'Maxigesic IV Licensed for Japan',
  'Telix Completes Acquisition of Tx Assets, Biologics Platform',
  'Licensing partnership in Saudi Arabia for Dapsone 5%, Gel',
  // CNINFO
  '恒瑞医药关于与Merck Healthcare签署HRS-1167和SHR-A1904项目授权许可协议的公告',
  '关于下属控股子公司浙江新码生物医药有限公司与Ambrx,Inc.签署《合作开发和许可协议》的公告',
  '前沿生物自愿披露关于收到与葛兰素史克签署的授权许可协议首付款的公告',
  '百奥泰 自愿披露关于与Hikma Pharmaceuticals USA Inc.就BAT2206（乌司奴单抗）注射液签署授权许可与商业化协议收到里程碑付款的公告',
  '君实生物自愿披露关于与利奥制药签署分销与商业化协议的公告',
  '关于签署许可及供应协议的公告',
  '中国国际金融股份有限公司关于上海君实生物医药科技股份有限公司与Anwita签署许可协议暨关联交易的核查意见',
  // TDnet
  'JPH034に関する、欧州バイオテック企業との非拘束的なライセンス契約骨子案（Non-Binding Term Sheet）締結のお知らせ',
  '甲状腺眼症治療薬「MHB018A」の導入に関するライセンス契約締結のお知らせ',
  '多発性硬化症の独占的グローバルライセンスを取得 米国保健福祉省との間で、BCVに関する開発のライセンス契約締結',
];

/** Titles the extractor rejected that are clear non-deals; the filter drops them for free. */
const NON_DEAL_TITLES: Array<[string, string]> = [
  ['[기재정정]최대주주변경을수반하는주식담보제공계약체결', 'title_equity_only'],
  ['단일판매ㆍ공급계약체결', 'title_equity_only'],
  ['투자판단관련주요경영사항 (ODS025 기술이전계약 관련 마일스톤 기술료 수령)', 'title_payment_receipt'],
  ['VOLUNTARY ANNOUNCEMENT - RECEIPT OF US$15 MILLION DEVELOPMENT MILESTONE PAYMENT', 'title_payment_receipt'],
  ['SECOND MILESTONE PAYMENT FROM NOVO FOR EXCLUSIVE LICENSE AGREEMENT OF UBT251', 'title_payment_receipt'],
  ['VOLUNTARY ANNOUNCEMENT CONDITIONAL APPROVALS IN RESPECT OF DIGITAL ASSET FINANCIAL SERVICES', 'title_non_pharma'],
  ['CONTINUING CONNECTED TRANSACTION - TRADEMARK LICENCE AGREEMENT', 'title_non_pharma'],
  ['关于与关联方签订《商标使用许可协议》的关联交易公告', 'title_non_pharma'],
  ['RENEWAL OF CONTINUING CONNECTED TRANSACTIONS RELATING TO THE NEW SUBLICENSE AGREEMENT', 'title_renewal'],
  ['TYK MEDICINES-B: UPDATE ON LICENSE AND COLLABORATION WITH QILU AND SETTLEMENT OF LEGAL PROCEEDING', 'title_litigation'],
  ['INSIDE INFORMATION TERMINATION OF LICENSE AGREEMENT AND', 'title_termination'],
  ['Termination of City of Hope Global IP License', 'title_termination'],
  ['GYM329 (emugrobart) の肥満症開発中止、ライセンス返還およびSMA開発再開に関するお知らせ', 'title_termination'],
  ['FDA Schedules GvHD Pre-License Manufacturing Inspection', 'title_regulatory_licence'],
  ['OGTR grants VAXINIA DIR licence allowing trial expansion', 'title_regulatory_licence'],
  ['共同開発品Tie2受容体アゴニスト（AV-001）の前期第２相臨床試験登録完了のお知らせ', 'title_reporting'],
  ['アルフェナックス バイオロジクス株式会社への共同出資に関する株式引受契約締結のお知らせ', 'title_equity_only'],
  ['Clarity signs a large-scale Manufacturing Supply Agreement', 'title_supply_only'],
  ['CSL Supply Agreement for UQ Vaccine with Commonwealth', 'title_supply_only'],
  ['Non-binding term sheet signed with BioCryst', 'title_supply_only'],
];

describe('deal pre-filter: title', () => {
  it.each(REAL_DEAL_TITLES)('keeps the real deal %s', (title) => {
    expect(screenTitle(title)).toEqual({ keep: true });
  });

  it.each(NON_DEAL_TITLES)('drops %s', (title, reason) => {
    expect(screenTitle(title)).toEqual({ keep: false, reason });
  });

  it('keeps licence titles the extractor got wrong under the thinking-block bug (they must reach it again)', () => {
    for (const t of [
      'INNOGEN-B: INSIDE INFORMATION - LICENCE AGREEMENT WITH ARCERA LIFE SCIENCES LTD',
      'Dimerix and Taiba enter into License Agreement for DMX-200',
      'ネクセラファーマ: 炎症性腸疾患を対象とした新規EP4受容体作動薬NXE0033744について、AbbVieとグローバルライセンス契約を締結',
      '한미약품: 투자판단관련주요경영사항 (파브리병 치료제(LAGLA) 기술이전 계약 체결)',
      '迈威生物关于全资子公司迈威（美国）与DISC签署独家许可协议的公告',
    ]) expect(screenTitle(t).keep).toBe(true);
  });

  it('passes an empty title (EDGAR documents have none)', () => {
    expect(screenTitle('')).toEqual({ keep: true });
    expect(screenTitle(null)).toEqual({ keep: true });
  });
});

describe('deal pre-filter: body', () => {
  it('drops a document with no life-science vocabulary (non-pharma HKEX issuers)', () => {
    expect(screenBody('The Company has obtained conditional approval to provide virtual asset dealing services to professional investors.'))
      .toEqual({ keep: false, reason: 'body_no_life_science' });
  });

  it('keeps biopharma documents in English, Chinese, Korean and Japanese', () => {
    expect(screenBody('Exclusive license to develop and commercialize the antibody in oncology.').keep).toBe(true);
    expect(screenBody('公司与对方签署许可协议，授予其在大中华区开发该药物的权利。').keep).toBe(true);
    expect(screenBody('파브리병 치료제 기술이전 계약을 체결하였습니다.').keep).toBe(true);
    expect(screenBody('当社は治療薬候補のライセンス契約を締結しました。').keep).toBe(true);
  });

  it('applies the title screen before the body screen', () => {
    expect(prefilterDocument({ title: 'Termination of City of Hope Global IP License', text: 'drug' })).toEqual({ keep: false, reason: 'title_termination' });
    expect(prefilterDocument({ title: 'License agreement', text: 'mining lease' })).toEqual({ keep: false, reason: 'body_no_life_science' });
    expect(prefilterDocument({ title: 'License agreement' })).toEqual({ keep: true });
  });
});
