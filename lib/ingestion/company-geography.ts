/**
 * Company Geography Classification
 *
 * Comprehensive lookup table of 350+ biopharma companies with headquarters
 * country, plus heuristic classification for unknown companies.
 * Used by deal ingestion, company enrichment, and country backfill.
 *
 * Country codes: ISO 3166-1 alpha-2 (US, CN, JP, KR, IL, GB, DE, FR, CH, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════
// REGION MAPPING
// ═══════════════════════════════════════════════════════════════════════

const COUNTRY_TO_REGION: Record<string, string> = {
  US: 'north_america', CA: 'north_america',
  GB: 'europe', DE: 'europe', FR: 'europe', CH: 'europe', NL: 'europe',
  BE: 'europe', DK: 'europe', SE: 'europe', NO: 'europe', FI: 'europe',
  IE: 'europe', IT: 'europe', ES: 'europe', AT: 'europe', PT: 'europe',
  LU: 'europe', IS: 'europe', CZ: 'europe', PL: 'europe', HU: 'europe',
  GR: 'europe', RO: 'europe', BG: 'europe', HR: 'europe', SI: 'europe',
  SK: 'europe', LT: 'europe', LV: 'europe', EE: 'europe',
  CN: 'china', HK: 'china', MO: 'china', TW: 'asia_pacific',
  JP: 'japan',
  KR: 'south_korea',
  IL: 'israel',
  IN: 'asia_pacific', SG: 'asia_pacific', AU: 'asia_pacific', NZ: 'asia_pacific',
  TH: 'asia_pacific', MY: 'asia_pacific', ID: 'asia_pacific', PH: 'asia_pacific',
  VN: 'asia_pacific',
  SA: 'middle_east', AE: 'middle_east', QA: 'middle_east', KW: 'middle_east',
  BH: 'middle_east', OM: 'middle_east', JO: 'middle_east', TR: 'middle_east',
  BR: 'latin_america', MX: 'latin_america', AR: 'latin_america', CL: 'latin_america',
  CO: 'latin_america', PE: 'latin_america',
  ZA: 'africa', EG: 'africa', NG: 'africa', KE: 'africa', MA: 'africa',
};

// ═══════════════════════════════════════════════════════════════════════
// COMPREHENSIVE COMPANY LOOKUP — 350+ companies
// ═══════════════════════════════════════════════════════════════════════

const COMPANY_COUNTRY_MAP: Record<string, string> = {
  // ── TOP 30 GLOBAL PHARMA ─────────────────────────────────────────
  'pfizer': 'US', 'merck': 'US', 'msd': 'US', 'merck sharp': 'US', 'merck & co': 'US',
  'johnson & johnson': 'US', 'j&j': 'US', 'janssen': 'US',
  'abbvie': 'US', 'eli lilly': 'US', 'lilly': 'US',
  'bristol-myers squibb': 'US', 'bristol myers squibb': 'US', 'bms': 'US',
  'amgen': 'US', 'gilead': 'US', 'gilead sciences': 'US',
  'regeneron': 'US', 'vertex': 'US', 'vertex pharmaceuticals': 'US',
  'biogen': 'US', 'moderna': 'US',
  'roche': 'CH', 'genentech': 'US', 'novartis': 'CH', 'sandoz': 'CH',
  'astrazeneca': 'GB', 'gsk': 'GB', 'glaxosmithkline': 'GB',
  'sanofi': 'FR', 'genzyme': 'US',
  'novo nordisk': 'DK', 'bayer': 'DE', 'boehringer ingelheim': 'DE',
  'boehringer': 'DE', 'merck kgaa': 'DE', 'emd serono': 'DE',
  'takeda': 'JP', 'daiichi sankyo': 'JP', 'astellas': 'JP',
  'eisai': 'JP', 'ono pharmaceutical': 'JP', 'shionogi': 'JP',
  'otsuka': 'JP', 'sumitomo pharma': 'JP', 'sumitomo dainippon': 'JP',
  'chugai': 'JP', 'chugai pharmaceutical': 'JP',
  'ucb': 'BE', 'ipsen': 'FR', 'servier': 'FR', 'almirall': 'ES',
  'grunenthal': 'DE', 'grünenthal': 'DE', 'menarini': 'IT',
  'lundbeck': 'DK', 'ferring': 'CH', 'galderma': 'CH',
  'teva': 'IL', 'teva pharmaceutical': 'IL',

  // ── US BIOTECHS ──────────────────────────────────────────────────
  'alnylam': 'US', 'alnylam pharmaceuticals': 'US',
  'biomarin': 'US', 'biomarin pharmaceutical': 'US',
  'incyte': 'US', 'incyte corporation': 'US',
  'jazz pharmaceuticals': 'US', 'jazz': 'US',
  'alexion': 'US', 'alexion pharmaceuticals': 'US',
  'seagen': 'US', 'seattle genetics': 'US',
  'neurocrine': 'US', 'neurocrine biosciences': 'US',
  'sarepta': 'US', 'sarepta therapeutics': 'US',
  'ultragenyx': 'US', 'ultragenyx pharmaceutical': 'US',
  'exact sciences': 'US', 'halozyme': 'US', 'ionis': 'US', 'ionis pharmaceuticals': 'US',
  'exelixis': 'US', 'bluebird bio': 'US', 'blueprint medicines': 'US',
  'agios': 'US', 'agios pharmaceuticals': 'US',
  'mirati': 'US', 'mirati therapeutics': 'US',
  'karuna therapeutics': 'US', 'prometheus biosciences': 'US',
  'horizon therapeutics': 'US', 'horizon': 'US',
  'arena pharmaceuticals': 'US', 'turning point therapeutics': 'US',
  'arcus biosciences': 'US', 'relay therapeutics': 'US',
  'revolution medicines': 'US', 'nuvalent': 'US',
  'krystal biotech': 'US', 'rocket pharmaceuticals': 'US',
  'crinetics': 'US', 'crinetics pharmaceuticals': 'US',
  'vir biotechnology': 'US', 'vir': 'US',
  'fate therapeutics': 'US', 'editas medicine': 'US',
  'intellia therapeutics': 'US', 'intellia': 'US',
  'crispr therapeutics': 'CH', 'beam therapeutics': 'US',
  'prime medicine': 'US', 'verve therapeutics': 'US',
  'denali therapeutics': 'US', 'denali': 'US',
  'annexon biosciences': 'US', 'praxis precision medicine': 'US',
  'cerevel therapeutics': 'US', 'sage therapeutics': 'US',
  'acadia pharmaceuticals': 'US', 'intra-cellular therapies': 'US',
  'agilix': 'US', 'recursion': 'US', 'recursion pharmaceuticals': 'US',
  'tempest therapeutics': 'US', 'repare therapeutics': 'US',
  'syndax pharmaceuticals': 'US', 'kinnate biopharma': 'US',
  'springworks therapeutics': 'US', 'day one biopharmaceuticals': 'US',
  'cogent biosciences': 'US', 'pyxis oncology': 'US',
  'compass therapeutics': 'US', 'erasca': 'US',
  'ideaya biosciences': 'US', 'inhibrx': 'US',
  'keros therapeutics': 'US', 'scholar rock': 'US',
  'madrigal pharmaceuticals': 'US', 'viking therapeutics': 'US',
  'structure therapeutics': 'US', 'terns pharmaceuticals': 'US',
  'metacrine': 'US', 'altimmune': 'US',
  'iovance biotherapeutics': 'US', 'adaptimmune': 'GB',
  'poseida therapeutics': 'US', 'precision biosciences': 'US',
  'sutro biopharma': 'US', 'zymeworks': 'CA',
  'xenon pharmaceuticals': 'CA', 'repligen': 'US',
  '10x genomics': 'US', 'twist bioscience': 'US',
  'codexis': 'US', 'absci': 'US',
  'roivant sciences': 'US', 'immunomedics': 'US',
  'acceleron pharma': 'US', 'myokardia': 'US',
  'global blood therapeutics': 'US', 'chinook therapeutics': 'US',
  'adc therapeutics': 'CH', 'passage bio': 'US',
  'protagonist therapeutics': 'US', 'apogee therapeutics': 'US',
  'ventyx biosciences': 'US', 'tg therapeutics': 'US',
  'immunogen': 'US', 'rigel': 'US', 'rigel pharmaceuticals': 'US',
  'bioatla': 'US', 'summit therapeutics': 'US',
  'imago biosciences': 'US', 'mirus bio': 'US',
  'pliant therapeutics': 'US', 'disc medicine': 'US',
  'cytokinetics': 'US', 'tenaya therapeutics': 'US',
  'acelyrin': 'US', 'alumis': 'US',

  // ── CHINESE BIOTECHS (comprehensive) ─────────────────────────────
  'beigene': 'CN', 'bei gene': 'CN',
  'legend biotech': 'CN', 'genscript': 'CN',
  'innovent': 'CN', 'innovent biologics': 'CN',
  'hengrui': 'CN', 'hengrui medicine': 'CN', 'jiangsu hengrui': 'CN',
  'hansoh': 'CN', 'hansoh pharmaceutical': 'CN', 'hansoh pharma': 'CN',
  'kelun': 'CN', 'kelun-biotech': 'CN', 'sichuan kelun': 'CN',
  'akeso': 'CN', 'akeso biopharma': 'CN',
  'junshi': 'CN', 'junshi biosciences': 'CN', 'shanghai junshi': 'CN',
  'hutchmed': 'CN', 'chi-med': 'CN', 'hutchison medipharma': 'CN',
  'zai lab': 'CN', 'zai': 'CN',
  'i-mab': 'CN', 'imab': 'CN',
  'connect biopharma': 'CN',
  'cstone': 'CN', 'cstone pharmaceuticals': 'CN',
  'adagene': 'CN',
  'laekna': 'CN', 'laekna therapeutics': 'CN',
  'simcere': 'CN', 'simcere pharmaceutical': 'CN',
  'luye pharma': 'CN', 'luye': 'CN',
  'qilu pharmaceutical': 'CN', 'qilu': 'CN',
  'harbour biomed': 'CN', 'harbour': 'CN',
  'jacobio': 'CN', 'jacobio pharmaceuticals': 'CN',
  'gloria biosciences': 'CN', 'gloria': 'CN',
  'alphamab': 'CN', 'alphamab oncology': 'CN',
  'transcenta': 'CN', 'transcenta holding': 'CN',
  'remegen': 'CN', 'rongchang bio': 'CN',
  'sciwind': 'CN', 'sciwind biosciences': 'CN',
  'antengene': 'CN', 'antengene corporation': 'CN',
  'betta pharmaceuticals': 'CN', 'betta': 'CN',
  'everest medicines': 'CN', 'everest': 'CN',
  'kindstar': 'CN', 'kintor': 'CN', 'kintor pharmaceutical': 'CN',
  'lepu biopharma': 'CN', 'lepu': 'CN',
  'mabpharm': 'CN',
  'genor biopharma': 'CN', 'genor': 'CN',
  'abbisko': 'CN', 'abbisko therapeutics': 'CN',
  'lanova medicines': 'CN', 'lanova': 'CN',
  'medshine discovery': 'CN', 'medshine': 'CN',
  'biocytogen': 'CN',
  'innocare': 'CN', 'innocare pharma': 'CN',
  'duality biologics': 'CN', 'duality bio': 'CN',
  'elpiscience': 'CN',
  'mabwell': 'CN', 'mabwell bioscience': 'CN',
  'adlai nortye': 'CN',
  'apollomics': 'CN',
  'ascentage': 'CN', 'ascentage pharma': 'CN',
  'sino biopharmaceutical': 'CN', 'sino biopharma': 'CN',
  'cspc pharmaceutical': 'CN', 'cspc': 'CN',
  'fosun pharma': 'CN', 'shanghai fosun': 'CN',
  'shanghai pharmaceuticals': 'CN',
  'china grand pharmaceutical': 'CN',
  'livzon pharmaceutical': 'CN', 'livzon': 'CN',
  'lee\'s pharmaceutical': 'HK', 'lee\'s pharma': 'HK',
  'lushan academy': 'CN', 'chia tai tianqing': 'CN',
  'lyell immunopharma': 'US',
  'gracell biotechnologies': 'CN', 'gracell': 'CN',
  'nuvation bio': 'US',
  'cdak': 'CN', 'dizal pharmaceutical': 'CN', 'dizal': 'CN',
  'sirnaomics': 'CN', 'clover biopharmaceuticals': 'CN',
  'drug farm': 'CN', 'brii biosciences': 'CN', 'brii bio': 'CN',
  'lianbia therapeutics': 'CN', 'lianbia': 'CN',
  'mainline biosciences': 'CN',
  'suzhou kintor': 'CN', 'suzhou alphamab': 'CN',
  'hangzhou zhongmei huadong': 'CN', 'huadong medicine': 'CN',
  'shanghai henlius': 'CN', 'henlius': 'CN',
  'cansinobio': 'CN', 'cansino biologics': 'CN',
  'wuxi biologics': 'CN', 'wuxi apptec': 'CN', 'wuxi': 'CN',
  'pharmaron': 'CN', 'chempartner': 'CN',
  'nanjing legend': 'CN',
  'mindray': 'CN',
  'bgm pharma': 'CN',
  'fapon biopharma': 'CN', 'fapon': 'CN', 'fapon biotech': 'CN',

  // ── KOREAN BIOTECHS ──────────────────────────────────────────────
  'samsung bioepis': 'KR', 'samsung biologics': 'KR',
  'celltrion': 'KR', 'celltrion healthcare': 'KR',
  'sk bioscience': 'KR', 'sk biopharmaceuticals': 'KR', 'sk life science': 'KR',
  'yuhan': 'KR', 'yuhan corporation': 'KR',
  'hanmi': 'KR', 'hanmi pharmaceutical': 'KR', 'hanmi pharm': 'KR',
  'gc biopharma': 'KR', 'gc pharma': 'KR', 'green cross': 'KR',
  'daewoong': 'KR', 'daewoong pharmaceutical': 'KR',
  'abl bio': 'KR',
  'boryung': 'KR', 'boryung pharmaceutical': 'KR',
  'hugel': 'KR', 'medytox': 'KR',
  'genexine': 'KR', 'eutilex': 'KR',
  'ildong': 'KR', 'ildong pharmaceutical': 'KR',
  'dong-a socio': 'KR', 'dong-a st': 'KR',
  'jw therapeutics': 'KR', 'cj healthcare': 'KR',
  'kolmar korea': 'KR', 'samsung medison': 'KR',
  'lk biosciences': 'KR', 'oscotec': 'KR',
  'bridge biotherapeutics': 'KR', 'alteogen': 'KR',
  'prestige biopharma': 'KR', 'pharmaresearch': 'KR',
  'ligachem': 'KR', 'ligachem biosciences': 'KR',
  'onegene': 'KR', 'vivozon': 'KR',
  'deepsonbio': 'KR',

  // ── ISRAELI BIOTECHS ─────────────────────────────────────────────
  'biolinex': 'IL', 'biolinrx': 'IL',
  'protalix': 'IL', 'protalix biotherapeutics': 'IL',
  'kamada': 'IL', 'kamada ltd': 'IL',
  'redhill': 'IL', 'redhill biopharma': 'IL',
  'compugen': 'IL',
  'can-fite': 'IL', 'can-fite biopharma': 'IL',
  'collplant': 'IL', 'gamida cell': 'IL',
  'brainsway': 'IL', 'plurilock': 'IL',
  'enlivex': 'IL', 'enlivex therapeutics': 'IL',
  'itamar medical': 'IL', 'nano-x': 'IL',
  'check-cap': 'IL', 'medigus': 'IL',
  'novolog': 'IL', 'biotechnology general': 'IL',

  // ── JAPANESE PHARMA / BIOTECH ────────────────────────────────────
  'dainippon sumitomo': 'JP', 'sumitomo dainippon pharma': 'JP',
  'mitsubishi tanabe': 'JP', 'mitsubishi tanabe pharma': 'JP',
  'kyowa kirin': 'JP', 'kyowa hakko kirin': 'JP',
  'meiji seika': 'JP', 'meiji seika pharma': 'JP',
  'taiho pharmaceutical': 'JP', 'taiho': 'JP',
  'nippon shinyaku': 'JP',
  'mochida pharmaceutical': 'JP',
  'zeria pharmaceutical': 'JP',
  'sawai pharmaceutical': 'JP', 'sawai': 'JP',
  'sosei': 'JP', 'sosei heptares': 'JP', 'heptares': 'GB',
  'daiichi': 'JP', 'sankyo': 'JP',
  'asubio pharma': 'JP', 'astellas pharma': 'JP',
  'torii pharmaceutical': 'JP', 'kissei': 'JP',
  'santen': 'JP', 'santen pharmaceutical': 'JP',
  'teijin pharma': 'JP', 'tsumura': 'JP',
  'ono': 'JP', 'ono pharma': 'JP',
  'fujifilm': 'JP', 'fujifilm diosynth': 'JP',
  'ajinomoto bio-pharma': 'JP', 'ajinomoto': 'JP',
  'peptidream': 'JP',

  // ── EUROPEAN BIOTECHS ────────────────────────────────────────────
  'biontech': 'DE', 'curevac': 'DE', 'morphosys': 'DE',
  'evotec': 'DE', 'heidelberg pharma': 'DE',
  'affimed': 'DE', 'immatics': 'DE',
  'galapagos': 'BE', 'argenx': 'NL',
  'pharming': 'NL', 'uniqure': 'NL',
  'genmab': 'DK', 'zealand pharma': 'DK', 'ascendis pharma': 'DK',
  'bavarian nordic': 'DK',
  'swedish orphan biovitrum': 'SE', 'sobi': 'SE',
  'orion': 'FI', 'orion pharma': 'FI',
  'jazz pharmaceuticals plc': 'IE', 'shire': 'IE',
  'horizon therapeutics plc': 'IE', 'allergan': 'IE',
  'alkermes': 'IE',
  'idorsia': 'CH', 'basilea': 'CH', 'relief therapeutics': 'CH',
  'molecular partners': 'CH', 'obseva': 'CH',
  'newron': 'IT', 'italfarmaco': 'IT', 'chiesi': 'IT',
  'grünenthal group': 'DE', 'stada': 'DE',
  'vifor pharma': 'CH', 'siegfried': 'CH',
  'recordati': 'IT', 'angelini pharma': 'IT',
  'pierre fabre': 'FR', 'bioderma': 'FR',
  'debiopharm': 'CH', 'polpharma': 'PL',
  'gedeon richter': 'HU', 'egis pharmaceuticals': 'HU',
  'orchard therapeutics': 'GB', 'autolus': 'GB',
  'silence therapeutics': 'GB', 'bicycle therapeutics': 'GB',
  'exscientia': 'GB', 'benevolentai': 'GB', 'benevolent ai': 'GB',
  'crescendo biologics': 'GB', 'kymab': 'GB',
  'nightstar therapeutics': 'GB', 'freeline therapeutics': 'GB',
  'achilles therapeutics': 'GB',

  // ── CANADIAN BIOTECHS ────────────────────────────────────────────
  'bausch health': 'CA', 'valeant': 'CA',
  'aurinia': 'CA', 'aurinia pharmaceuticals': 'CA',
  'essa pharma': 'CA', 'sierra oncology': 'CA',
  'profound medical': 'CA', 'liminal biosciences': 'CA',
  'medicenna': 'CA', 'fusion pharmaceuticals': 'CA',
  'repare therapeutics': 'CA', 'molecular data': 'CA',

  // ── INDIAN PHARMA ────────────────────────────────────────────────
  'sun pharma': 'IN', 'sun pharmaceutical': 'IN',
  'dr. reddy\'s': 'IN', 'dr reddys': 'IN',
  'cipla': 'IN', 'lupin': 'IN', 'aurobindo': 'IN',
  'biocon': 'IN', 'glenmark': 'IN',
  'torrent pharmaceuticals': 'IN', 'zydus': 'IN', 'zydus cadila': 'IN',
  'natco pharma': 'IN', 'mankind pharma': 'IN',

  // ── AUSTRALIAN BIOTECHS ──────────────────────────────────────────
  'csl': 'AU', 'csl behring': 'AU', 'csl seqirus': 'AU',
  'mesoblast': 'AU', 'clinuvel': 'AU',
  'opthea': 'AU', 'telix pharmaceuticals': 'AU',
  'immuron': 'AU', 'immutep': 'AU',

  // ── MAJOR CROs / CDMOs / SERVICE ─────────────────────────────────
  'iqvia': 'US', 'labcorp': 'US', 'covance': 'US',
  'ppd': 'US', 'thermo fisher': 'US',
  'parexel': 'US', 'icon plc': 'IE',
  'syneos health': 'US', 'lumanity': 'US',
  'medpace': 'US', 'pra health sciences': 'US',
  'novotech': 'AU', 'emerald clinical': 'US',
  'catalent': 'US', 'lonza': 'CH',
  'samsung biologics cdmo': 'KR',
  'boehringer ingelheim biopharmaceuticals': 'DE',
  'patheon': 'CA', 'recipharm': 'SE',
  'charles river': 'US', 'charles river laboratories': 'US',
};

// ═══════════════════════════════════════════════════════════════════════
// CHINESE CITY / REGION PATTERNS
// ═══════════════════════════════════════════════════════════════════════

const CHINESE_CITY_PATTERNS = [
  'shanghai', 'beijing', 'suzhou', 'hangzhou', 'guangzhou', 'shenzhen',
  'chengdu', 'wuhan', 'nanjing', 'tianjin', 'qingdao', 'dalian',
  'xiamen', 'kunming', 'hefei', 'zhengzhou', 'jinan', 'changsha',
  'fuzhou', 'dongguan', 'foshan', 'jiangsu', 'zhejiang', 'shandong',
  'guangdong', 'sichuan', 'hubei', 'hunan', 'fujian', 'liaoning',
  'hebei', 'anhui', 'hainan', 'hong kong',
];

const KOREAN_CITY_PATTERNS = [
  'seoul', 'incheon', 'busan', 'daegu', 'daejeon', 'gwangju',
  'ulsan', 'sejong', 'gyeonggi', 'pangyo', 'bundang',
];

const JAPANESE_PATTERNS = [
  'tokyo', 'osaka', 'kyoto', 'nagoya', 'kobe', 'yokohama',
  'fukuoka', 'sapporo', 'sendai', 'hiroshima',
];

// Structural naming patterns by country
const CHINESE_SUFFIXES = [
  'pharma co., ltd', 'pharma co.,ltd', 'pharmaceutical co., ltd',
  'biopharmaceutical co., ltd', 'biotechnology co., ltd',
  'biotech co., ltd', 'medicine co., ltd',
  'pharma group', 'pharmaceutical group',
];

const KOREAN_SUFFIXES = [
  'co., ltd.', 'corporation', 'holdings',
];

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

export interface CompanyGeoResult {
  country: string;
  region: string;
  confidence: 'high' | 'medium' | 'low';
}

function normalizeForLookup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.'"\-()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\binc\b|\bltd\b|\bllc\b|\bcorp\b|\bcorporation\b|\bplc\b|\bag\b|\bsa\b|\bse\b|\bgmbh\b|\bco\b/g, '')
    .trim();
}

export function classifyCompanyCountry(companyName: string): CompanyGeoResult {
  if (!companyName) {
    return { country: 'unknown', region: 'unknown', confidence: 'low' };
  }

  const normalized = normalizeForLookup(companyName);
  const lower = companyName.toLowerCase();

  // 1. Direct lookup (high confidence)
  for (const [key, country] of Object.entries(COMPANY_COUNTRY_MAP)) {
    if (normalized === normalizeForLookup(key) || normalized.includes(normalizeForLookup(key))) {
      return { country, region: deriveRegion(country), confidence: 'high' };
    }
  }

  // Also check if any lookup key is contained in the normalized name
  for (const [key, country] of Object.entries(COMPANY_COUNTRY_MAP)) {
    const normalizedKey = normalizeForLookup(key);
    if (normalizedKey.length >= 4 && normalized.includes(normalizedKey)) {
      return { country, region: deriveRegion(country), confidence: 'high' };
    }
  }

  // 2. Chinese heuristics (medium confidence)
  // Chinese characters present
  if (/[一-鿿]/.test(companyName)) {
    return { country: 'CN', region: 'china', confidence: 'medium' };
  }

  // Chinese city names in company name
  for (const city of CHINESE_CITY_PATTERNS) {
    if (lower.includes(city)) {
      return { country: 'CN', region: 'china', confidence: 'medium' };
    }
  }

  // Chinese corporate suffixes
  for (const suffix of CHINESE_SUFFIXES) {
    if (lower.includes(suffix)) {
      return { country: 'CN', region: 'china', confidence: 'medium' };
    }
  }

  // 3. Korean heuristics (medium confidence)
  for (const city of KOREAN_CITY_PATTERNS) {
    if (lower.includes(city)) {
      return { country: 'KR', region: 'south_korea', confidence: 'medium' };
    }
  }

  // 4. Japanese heuristics (medium confidence)
  for (const pattern of JAPANESE_PATTERNS) {
    if (lower.includes(pattern)) {
      return { country: 'JP', region: 'japan', confidence: 'medium' };
    }
  }

  // 5. Japanese corporate suffixes
  if (lower.includes('kabushiki') || lower.includes('k.k.')) {
    return { country: 'JP', region: 'japan', confidence: 'medium' };
  }

  // 6. Korean corporate patterns
  if (lower.includes('cheil') || lower.includes('hankook') || lower.includes('hyundai')) {
    return { country: 'KR', region: 'south_korea', confidence: 'medium' };
  }

  // 7. German/Swiss patterns
  if (lower.endsWith(' ag') || lower.includes(' gmbh')) {
    return { country: 'DE', region: 'europe', confidence: 'medium' };
  }

  // 8. French patterns
  if (lower.endsWith(' sa') && !lower.includes('usa')) {
    return { country: 'FR', region: 'europe', confidence: 'medium' };
  }

  // 9. Indian patterns
  if (lower.includes('india') || lower.includes('mumbai') || lower.includes('hyderabad pharma')) {
    return { country: 'IN', region: 'asia_pacific', confidence: 'medium' };
  }

  return { country: 'unknown', region: 'unknown', confidence: 'low' };
}

export function deriveRegion(country: string): string {
  if (!country || country === 'unknown') return 'unknown';
  return COUNTRY_TO_REGION[country] || 'unknown';
}

export function deriveDealCorridor(licensorCountry: string, licenseeCountry: string): string | null {
  if (!licensorCountry || !licenseeCountry || licensorCountry === 'unknown' || licenseeCountry === 'unknown') {
    return null;
  }
  if (licensorCountry === licenseeCountry) return null;

  const regionA = deriveRegion(licensorCountry);
  const regionB = deriveRegion(licenseeCountry);

  // Use region-level corridor names for readability
  const REGION_LABELS: Record<string, string> = {
    north_america: 'us', china: 'cn', japan: 'jp',
    south_korea: 'kr', israel: 'il', europe: 'eu',
    asia_pacific: 'apac', middle_east: 'mena',
    latin_america: 'latam', africa: 'africa',
  };

  const from = REGION_LABELS[regionA] || licensorCountry.toLowerCase();
  const to = REGION_LABELS[regionB] || licenseeCountry.toLowerCase();
  return `${from}_to_${to}`;
}

export function classifyAndEnrichDeal(
  licensorName: string,
  licenseeName: string,
): {
  licensor_country: string;
  licensee_country: string;
  licensor_region: string;
  licensee_region: string;
  cross_border: boolean;
  deal_corridor: string | null;
} {
  const licensor = classifyCompanyCountry(licensorName);
  const licensee = classifyCompanyCountry(licenseeName);

  return {
    licensor_country: licensor.country,
    licensee_country: licensee.country,
    licensor_region: licensor.region,
    licensee_region: licensee.region,
    cross_border: licensor.country !== licensee.country && licensor.country !== 'unknown' && licensee.country !== 'unknown',
    deal_corridor: deriveDealCorridor(licensor.country, licensee.country),
  };
}
