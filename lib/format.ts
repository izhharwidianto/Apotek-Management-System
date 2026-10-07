export const formatIDR = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  return 'Rp ' + v.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const formatIDRPlain = (n: number): string => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const formatDate = (d: string | Date | null): string => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (d: string | Date | null): string => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const daysUntil = (d: string | Date | null): number | null => {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
};

export const genInvoiceNo = (): string => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 900) + 100;
  const time = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
  return `INV-${ymd}-${time}${rand}`;
};
