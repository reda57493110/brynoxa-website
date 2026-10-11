export function formatCurrency(amount: number) {
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
  // LTR mark keeps "1,200 DH" readable inside RTL pages
  return `\u200E${formatted} DH`
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/** Whole dirhams for summary figures (KPIs, averages): "1,375 DH" rather than "1,375.41 DH". */
export function formatCurrencyRounded(amount: number) {
  return formatCurrency(Math.round(amount))
}
