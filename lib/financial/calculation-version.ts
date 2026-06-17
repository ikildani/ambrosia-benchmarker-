/**
 * Calculation versioning for reproducibility.
 * Generates a deterministic hash from inputs + engine version
 * so institutional users can verify reproducibility.
 */

const ENGINE_VERSION = '5.1.0';

export function computeCalculationFingerprint(inputs: Record<string, unknown>): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return `v${ENGINE_VERSION}-${Math.abs(hash).toString(36)}`;
}

export { ENGINE_VERSION };
