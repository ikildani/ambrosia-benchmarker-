/**
 * Canonical formatting utilities for the Solidus platform.
 * ALL currency, percentage, and number formatting MUST use these functions.
 * Do NOT create local formatters in components or lib files.
 */

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0M';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}B`;
  }
  if (abs < 1 && abs > 0) {
    return `${sign}$${(abs * 1000).toFixed(0)}K`;
  }
  return `${sign}$${Math.round(abs)}M`;
}

export function formatRawUsd(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0';
  return formatCurrency(value / 1_000_000);
}

export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

export function formatRange(range: { low: number; median: number; high: number }): string {
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`;
}

export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value == null || isNaN(value)) return '0';
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals });
}
