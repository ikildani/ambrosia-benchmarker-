/**
 * Known datacenter IP prefixes for view classification.
 *
 * These ranges cover the cloud providers whose IPs showed up in the 2026-04-10
 * audit of the share-view event log. The pattern was: real prospect (Vishaal)
 * shares the link in 1-2 places, but Microsoft Defender Safe Links + Outlook
 * scanner + Google Workspace link previewer + Slack unfurler all hit the URL
 * within seconds, inflating the apparent "view count" 5-8x and drowning real
 * engagement signals in bot noise.
 *
 * Source ranges:
 *   - GCP (34.x, 35.x): https://www.gstatic.com/ipranges/cloud.json
 *   - AWS (3.x, 13.x, 18.x, 35.x, 52.x, 54.x): https://ip-ranges.amazonaws.com/ip-ranges.json
 *   - Azure: https://www.microsoft.com/en-us/download/details.aspx?id=56519
 *   - Cloudflare: https://www.cloudflare.com/ips-v4
 *   - Microsoft (Outlook Safe Links scanner): 40.x, 52.x, 104.x, 137.x, 205.16x
 *
 * We match by IP prefix (the events table stores anonymized prefixes like
 * '34.118***'), so this is necessarily approximate. False positives (real users
 * on cloud-hosted VPNs) are acceptable — the cost of missing a few real views
 * is much lower than the cost of alerting on dozens of bot rescans.
 *
 * Updated 2026-04-10 from the actual datacenter IPs observed hitting the
 * QNBPUbTI3gfY share token.
 */

/** Known datacenter prefix patterns. Match against the FIRST OCTET ONLY of the IP. */
export const DATACENTER_FIRST_OCTETS = new Set<string>([
  // Google Cloud
  '34', '35', '104', '107', '130', '146', '199', '208',
  // AWS
  '3', '13', '15', '18', '52', '54', '99', '107', '184',
  // Microsoft Azure / Office 365 / Outlook Safe Links
  '20', '40', '51', '65', '70', '94', '104', '131', '137', '157', '168', '191',
  // Cloudflare
  '162', '172', '173', '188', '198',
  // Other major hosts (DigitalOcean, Linode, OVH)
  '45', '64', '67', '104', '139', '142', '159', '161', '167', '178', '188',
]);

/** More precise known prefixes (first two octets) for sharper classification. */
export const DATACENTER_PREFIXES_2OCTET = new Set<string>([
  // GCP commonly seen in audit
  '34.71', '34.72', '34.116', '34.118', '34.122', '34.123', '34.144', '34.145',
  '35.184', '35.185', '35.190', '35.192', '35.193', '35.196', '35.197', '35.198',
  '35.199', '35.200', '35.201', '35.202', '35.203', '35.204', '35.205', '35.222',
  '35.223', '35.224', '35.225', '35.226', '35.227', '35.228', '35.229', '35.230',
  '35.231', '35.232', '35.233', '35.234', '35.235', '35.236', '35.237', '35.238',
  '35.239', '35.240', '35.241', '35.242', '35.243', '35.244', '35.245', '35.246',
  '35.247',
  // AWS commonly seen in audit
  '3.5', '3.80', '3.81', '3.82', '3.83', '3.84', '3.85', '3.86', '3.87', '3.88',
  '13.32', '13.33', '13.224', '13.225', '13.226', '13.227', '13.228', '13.229',
  '18.130', '18.135', '18.136', '18.140', '18.141', '18.142', '18.144', '18.156',
  '18.157', '18.158', '18.159', '18.160', '18.161', '18.162', '18.163', '18.164',
  '18.165', '18.184', '18.185', '18.190', '18.191', '18.192', '18.194', '18.195',
  '18.196', '18.197', '18.198', '18.200', '18.205', '18.206', '18.207', '18.208',
  '18.209', '18.210', '18.211', '18.212', '18.213', '18.214', '18.215', '18.216',
  '18.217', '18.218', '18.219', '18.220', '18.221', '18.222', '18.223', '18.224',
  '18.230', '18.231', '18.232', '18.233', '18.234', '18.235', '18.236', '18.237',
  '52.1', '52.2', '52.3', '52.4', '52.5', '52.6', '52.7', '52.8', '52.9',
  '52.10', '52.11', '52.12', '52.13', '52.14', '52.15', '52.16', '52.17',
  '52.18', '52.19', '52.20', '52.21', '52.22', '52.23', '52.24', '52.25',
  '52.26', '52.27', '52.28', '52.29', '52.30', '52.31', '52.32', '52.33',
  '52.34', '52.35', '52.36', '52.37', '52.38', '52.39', '52.40', '52.41',
  // Microsoft Outlook Safe Links / Bing scanners
  '40.76', '40.77', '40.79', '40.80', '40.83', '40.84', '40.85', '40.86',
  '40.87', '40.88', '40.89', '40.90', '40.91', '40.92', '40.93', '40.94',
  '40.95', '40.96', '40.97', '40.98', '40.99', '40.100', '40.101', '40.102',
  '40.103', '40.104', '40.105', '40.106', '40.107', '40.108', '40.109', '40.110',
  '40.111', '40.112', '40.113', '40.114', '40.115', '40.116', '40.117', '40.118',
  '40.119', '40.120', '40.121', '40.122', '40.123', '40.124', '40.125', '40.126',
  '205.16', '157.55', '157.56', '207.46', '65.52',
]);

/**
 * Returns true if the given IP (or anonymized prefix like '34.118***') matches a
 * known datacenter range. Tries the more-specific 2-octet match first; falls
 * back to first-octet for coverage.
 */
export function isDatacenterIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;

  // Strip anonymization markers (***) and split on dots
  const cleaned = ip.replace(/\*+/g, '').replace(/\.$/, '');
  const parts = cleaned.split('.');
  if (parts.length === 0) return false;

  // Try 2-octet match (more precise)
  if (parts.length >= 2) {
    const twoOctet = `${parts[0]}.${parts[1]}`;
    if (DATACENTER_PREFIXES_2OCTET.has(twoOctet)) return true;
  }

  // We deliberately do NOT fall back to first-octet matching alone — many
  // residential ISPs share /8s with cloud providers (e.g. Comcast 73.x is in
  // the same /8 as some DigitalOcean ranges), so first-octet false positives
  // would be too aggressive. The 2-octet check is the sweet spot.

  return false;
}
