// تنسيق الأرقام والتواريخ بالعربية
const arDate = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const arDateTime = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(ts: number): string {
  return arDate.format(new Date(ts));
}

export function formatDateTime(ts: number): string {
  return arDateTime.format(new Date(ts));
}

export function formatAmount(n: number): string {
  return new Intl.NumberFormat("ar-EG").format(n);
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
