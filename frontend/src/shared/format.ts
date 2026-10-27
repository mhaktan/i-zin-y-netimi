const LOCALE = "tr-TR";

/** Kullanici metnini HTML hucresine guvenli yazar */
export const escHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Tarih: yalniz tarih alani (YYYY-MM-DD...) saat dilimine gore kaymadan gg.aa.yyyy;
 * saatli alan yerel saatle. Bos/gecersiz → —
 */
export const formatDate = (value: unknown, withTime = false): string => {
  if (value == null || value === '') return '\u2014';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!withTime && m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return escHtml(s);
  return withTime
    ? d.toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
};
