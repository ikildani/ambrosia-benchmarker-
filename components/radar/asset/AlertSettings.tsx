'use client';

import { AlertRuleForm } from '@/components/radar/alerts/AlertRuleForm';

/**
 * Per-asset alert rules on the brief sidebar: score threshold, partnership
 * change, catalyst window, pinned to this asset via config.asset_id. The
 * account-wide form (watchlist activity, mandate digests) is /radar/alerts.
 */
export function AlertSettings({ assetId }: { assetId: string }) {
  return <AlertRuleForm assetId={assetId} />;
}
