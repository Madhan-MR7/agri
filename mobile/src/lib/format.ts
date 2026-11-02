export const titleCase = (s: string | undefined | null) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export const pct = (v: number | null | undefined, digits = 0) => (v == null ? '–' : `${(v * 100).toFixed(digits)}%`);

export const fmtValue = (v: number | string) =>
  typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : titleCase(v);

export const fmtDate = (iso: string, withTime = true) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};

/** The LLM replies in markdown; plain Text can't render it, so drop the emphasis markers. */
export const stripMarkdown = (s: string) => s.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
