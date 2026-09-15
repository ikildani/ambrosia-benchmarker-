/**
 * Consumer / free-mail domains. An email on one of these tells us nothing
 * about the person's company, so domain-based enrichment must skip it.
 */
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.co.jp', 'ymail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.se', 'live.com', 'live.co.uk', 'msn.com',
  'outlook.com', 'outlook.de', 'outlook.fr', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'proton.me', 'pm.me', 'gmx.com', 'gmx.de', 'gmx.net', 'web.de', 'mail.com', 'mail.ru', 'yandex.com', 'yandex.ru',
  'zoho.com', 'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com', 'aliyun.com', 'sina.com', 'foxmail.com',
  'naver.com', 'daum.net', 'hanmail.net', 'rediffmail.com', 'tutanota.com', 'tuta.io', 'comcast.net', 'verizon.net',
  'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net', 'btinternet.com', 'sky.com', 'orange.fr', 'wanadoo.fr',
  'free.fr', 'laposte.net', 't-online.de', 'libero.it', 'virgilio.it', 'telenet.be', 'skynet.be', 'ziggo.nl',
  'xs4all.nl', 'shaw.ca', 'rogers.com', 'sympatico.ca', 'bigpond.com', 'optusnet.com.au', 'duck.com', 'example.com',
]);

/** Academic and hospital domains are institutions, not companies. Keep the domain but do not treat it as a company. */
const ACADEMIC_TLD_PATTERNS = [/\.edu$/, /\.ac\.[a-z]{2}$/, /\.edu\.[a-z]{2}$/, /^uni-[a-z-]+\.de$/, /\.uni-[a-z-]+\.de$/, /\.nhs\.uk$/];

export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase().trim());
}

export function isAcademicDomain(domain: string): boolean {
  const d = domain.toLowerCase().trim();
  return ACADEMIC_TLD_PATTERNS.some(p => p.test(d));
}

/** Lower-cased domain of an email, or null when it is malformed. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}
