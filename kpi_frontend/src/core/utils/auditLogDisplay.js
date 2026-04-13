/**
 * Helpers to present audit log `data` JSON in a human-friendly way.
 */

const KEY_ORDER = [
  'loginAt',
  'sessionId',
  'deviceInfo',
  'ipAddress',
  'ip',
  'reason',
];

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown>|null}
 */
export function parseAuditDataPayload(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return { _message: raw };
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  return { value: raw };
}

/**
 * Short browser / OS line from a User-Agent string (best-effort, no external lib).
 * @param {string} ua
 * @returns {string}
 */
export function summarizeUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return '';
  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let os = '';
  if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.2/i.test(ua)) os = 'Windows 8';
  else if (/Windows NT 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : '';
}

/**
 * @param {string} ip
 * @returns {{ isLocal: boolean, hint: 'loopback' | 'none' }}
 */
export function describeIpAddress(ip) {
  if (!ip || typeof ip !== 'string') return { isLocal: false, hint: 'none' };
  const t = ip.trim().toLowerCase();
  if (
    t === '127.0.0.1' ||
    t === '::1' ||
    t === '0:0:0:0:0:0:0:1' ||
    t === 'localhost'
  ) {
    return { isLocal: true, hint: 'loopback' };
  }
  return { isLocal: false, hint: 'none' };
}

/**
 * @param {string} key
 * @returns {string}
 */
export function humanizeFieldKey(key) {
  if (!key || typeof key !== 'string') return '';
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Stable key order: known keys first, then alphabetical.
 * @param {string[]} keys
 * @returns {string[]}
 */
export function sortAuditDataKeys(keys) {
  const known = KEY_ORDER.filter((k) => keys.includes(k));
  const knownSet = new Set(KEY_ORDER);
  const rest = keys.filter((k) => !knownSet.has(k)).sort((a, b) =>
    a.localeCompare(b)
  );
  return [...known, ...rest];
}

/**
 * @param {unknown} val
 * @returns {boolean}
 */
function looksLikeIsoDateString(val) {
  return (
    typeof val === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)
  );
}

/**
 * Build UI-oriented rows from parsed audit data.
 * @param {Record<string, unknown>} data
 * @param {object} ctx
 * @param {function(string): string} ctx.t — i18n translate
 * @param {function(string): boolean} ctx.te — i18n key exists
 * @param {(d: string|Date) => string} ctx.formatDateTime
 * @returns {Array<{ key: string, kind: string, label: string, primary?: string, secondary?: string, mono?: string, raw?: string, isLocal?: boolean }>}
 */
export function buildAuditDataRows(data, { t, te, formatDateTime }) {
  if (!data || typeof data !== 'object') return [];

  const fieldLabel = (key) =>
    te(`auditLogDetail.fields.${key}`)
      ? t(`auditLogDetail.fields.${key}`)
      : humanizeFieldKey(key);

  const keys = sortAuditDataKeys(Object.keys(data));
  const rows = [];

  for (const key of keys) {
    const val = data[key];
    const label = fieldLabel(key);

    if (key === '_message') {
      rows.push({
        key,
        kind: 'text',
        label: fieldLabel('_message'),
        primary: String(val ?? ''),
      });
      continue;
    }

    if (key === 'deviceInfo' && typeof val === 'string') {
      const summary = summarizeUserAgent(val);
      rows.push({
        key,
        kind: 'userAgent',
        label,
        primary: summary || t('auditLogDetail.unknownDevice'),
        secondary: val,
      });
      continue;
    }

    if ((key === 'ipAddress' || key === 'ip') && typeof val === 'string') {
      const { isLocal } = describeIpAddress(val);
      rows.push({
        key,
        kind: 'ip',
        label,
        primary: val,
        isLocal,
      });
      continue;
    }

    if (key === 'sessionId' && typeof val === 'string') {
      rows.push({
        key,
        kind: 'session',
        label,
        mono: val,
      });
      continue;
    }

    if (key === 'reason') {
      const code = String(val ?? '');
      const reasonKey = `auditLogDetail.reasons.${code}`;
      const text = te(reasonKey)
        ? t(reasonKey)
        : humanizeFieldKey(code);
      rows.push({
        key,
        kind: 'text',
        label,
        primary: text,
      });
      continue;
    }

    if (
      key === 'loginAt' &&
      (val instanceof Date || looksLikeIsoDateString(val) || typeof val === 'string')
    ) {
      const d = val instanceof Date ? val : val;
      rows.push({
        key,
        kind: 'text',
        label,
        primary: formatDateTime(d),
      });
      continue;
    }

    if (
      typeof val === 'string' &&
      (key.toLowerCase().endsWith('at') ||
        key.toLowerCase().includes('date') ||
        key.toLowerCase().includes('time')) &&
      looksLikeIsoDateString(val)
    ) {
      rows.push({
        key,
        kind: 'text',
        label,
        primary: formatDateTime(val),
      });
      continue;
    }

    if (val !== null && typeof val === 'object') {
      rows.push({
        key,
        kind: 'json',
        label,
        raw: JSON.stringify(val, null, 2),
      });
      continue;
    }

    rows.push({
      key,
      kind: 'text',
      label,
      primary: val === null || val === undefined ? '—' : String(val),
    });
  }

  return rows;
}
