/**
 * Auto-updates LIVE_DEAL_COUNT and VERIFIED_DEAL_COUNT in
 * lib/config/constants.ts via GitHub API when either rounded display value
 * changes (e.g., crosses from 1,600+ to 1,700+). Called by the daily-stats cron.
 *
 * LIVE = tracked (quality-filtered) rows; VERIFIED = verified=true rows. The
 * two are updated together so the site never shows a stale pairing.
 */

import { LIVE_DEAL_COUNT, VERIFIED_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

const GITHUB_REPO = 'ikildani/ambrosia-benchmarker-';
const FILE_PATH = 'lib/config/constants.ts';

interface UpdateResult {
  updated: boolean;
  previousCount: number;
  newCount: number;
  previousDisplay: string;
  newDisplay: string;
  previousVerifiedCount: number;
  newVerifiedCount: number;
}

/**
 * @param liveDealCount     tracked rows (see lib/deals/quality-filter)
 * @param verifiedDealCount verified=true rows; defaults to the current constant
 *                          so older callers that only know the live count keep working
 */
export async function updateDealCountIfChanged(
  liveDealCount: number,
  verifiedDealCount: number = VERIFIED_DEAL_COUNT,
): Promise<UpdateResult> {
  const previousDisplay = formatDealCount(LIVE_DEAL_COUNT);
  const newDisplay = formatDealCount(liveDealCount);
  const previousVerifiedDisplay = formatDealCount(VERIFIED_DEAL_COUNT);
  const newVerifiedDisplay = formatDealCount(verifiedDealCount);
  const base = {
    previousCount: LIVE_DEAL_COUNT,
    newCount: liveDealCount,
    previousDisplay,
    newDisplay,
    previousVerifiedCount: VERIFIED_DEAL_COUNT,
    newVerifiedCount: verifiedDealCount,
  };

  // Only update if either rounded display value actually changed
  if (previousDisplay === newDisplay && previousVerifiedDisplay === newVerifiedDisplay) {
    return { updated: false, ...base };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('[DealCountUpdater] GITHUB_TOKEN not configured — skipping auto-update');
    return { updated: false, ...base };
  }

  try {
    // Get current file content + SHA
    const getResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      console.error('[DealCountUpdater] Failed to get file:', getResponse.status);
      return { updated: false, ...base };
    }

    const fileData = await getResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const sha = fileData.sha;

    // Replace both counts
    const updatedContent = currentContent
      .replace(/export const LIVE_DEAL_COUNT = \d+;/, `export const LIVE_DEAL_COUNT = ${liveDealCount};`)
      .replace(/export const VERIFIED_DEAL_COUNT = \d+;/, `export const VERIFIED_DEAL_COUNT = ${verifiedDealCount};`);

    if (updatedContent === currentContent) {
      console.log('[DealCountUpdater] No change in file content');
      return { updated: false, ...base };
    }

    // Commit the update
    const putResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Auto-update deal counts: live ${LIVE_DEAL_COUNT} → ${liveDealCount} (${previousDisplay} → ${newDisplay}), verified ${VERIFIED_DEAL_COUNT} → ${verifiedDealCount} (${previousVerifiedDisplay} → ${newVerifiedDisplay})`,
          content: Buffer.from(updatedContent).toString('base64'),
          sha,
          branch: 'main',
        }),
      }
    );

    if (!putResponse.ok) {
      const errorBody = await putResponse.text();
      console.error('[DealCountUpdater] Failed to update file:', putResponse.status, errorBody);
      return { updated: false, ...base };
    }

    console.log(`[DealCountUpdater] Updated counts: live ${LIVE_DEAL_COUNT} → ${liveDealCount}, verified ${VERIFIED_DEAL_COUNT} → ${verifiedDealCount}`);

    return { updated: true, ...base };
  } catch (error) {
    console.error('[DealCountUpdater] Error:', error);
    return { updated: false, ...base };
  }
}
