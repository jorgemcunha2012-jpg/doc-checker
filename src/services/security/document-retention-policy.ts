const RETENTION_DAYS = 40;

export function documentRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function documentRetentionReason() {
  return `RETENTION_${RETENTION_DAYS}_DAYS`;
}
