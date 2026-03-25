/**
 * Auto-updates LIVE_DEAL_COUNT in lib/config/constants.ts via GitHub API
 * when the rounded deal count changes (e.g., crosses from 3,400+ to 3,500+).
 * Called by the daily-stats cron.
 */

import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

const GITHUB_REPO = 'ikildani/ambrosia-benchmarker-';
const FILE_PATH = 'lib/config/constants.ts';

interface UpdateResult {
  updated: boolean;
  previousCount: number;
  newCount: number;
  previousDisplay: string;
  newDisplay: string;
}

export async function updateDealCountIfChanged(verifiedDealCount: number): Promise<UpdateResult> {
  const previousDisplay = formatDealCount(LIVE_DEAL_COUNT);
  const newDisplay = formatDealCount(verifiedDealCount);

  // Only update if the rounded display value actually changed
  if (previousDisplay === newDisplay) {
    return {
      updated: false,
      previousCount: LIVE_DEAL_COUNT,
      newCount: verifiedDealCount,
      previousDisplay,
      newDisplay,
    };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('[DealCountUpdater] GITHUB_TOKEN not configured — skipping auto-update');
    return {
      updated: false,
      previousCount: LIVE_DEAL_COUNT,
      newCount: verifiedDealCount,
      previousDisplay,
      newDisplay,
    };
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
      return { updated: false, previousCount: LIVE_DEAL_COUNT, newCount: verifiedDealCount, previousDisplay, newDisplay };
    }

    const fileData = await getResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const sha = fileData.sha;

    // Replace the LIVE_DEAL_COUNT value
    const updatedContent = currentContent.replace(
      /export const LIVE_DEAL_COUNT = \d+;/,
      `export const LIVE_DEAL_COUNT = ${verifiedDealCount};`
    );

    if (updatedContent === currentContent) {
      console.log('[DealCountUpdater] No change in file content');
      return { updated: false, previousCount: LIVE_DEAL_COUNT, newCount: verifiedDealCount, previousDisplay, newDisplay };
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
          message: `Auto-update LIVE_DEAL_COUNT: ${LIVE_DEAL_COUNT} → ${verifiedDealCount} (${previousDisplay} → ${newDisplay})`,
          content: Buffer.from(updatedContent).toString('base64'),
          sha,
          branch: 'main',
        }),
      }
    );

    if (!putResponse.ok) {
      const errorBody = await putResponse.text();
      console.error('[DealCountUpdater] Failed to update file:', putResponse.status, errorBody);
      return { updated: false, previousCount: LIVE_DEAL_COUNT, newCount: verifiedDealCount, previousDisplay, newDisplay };
    }

    console.log(`[DealCountUpdater] Updated LIVE_DEAL_COUNT: ${LIVE_DEAL_COUNT} → ${verifiedDealCount} (${previousDisplay} → ${newDisplay})`);

    return {
      updated: true,
      previousCount: LIVE_DEAL_COUNT,
      newCount: verifiedDealCount,
      previousDisplay,
      newDisplay,
    };
  } catch (error) {
    console.error('[DealCountUpdater] Error:', error);
    return { updated: false, previousCount: LIVE_DEAL_COUNT, newCount: verifiedDealCount, previousDisplay, newDisplay };
  }
}
