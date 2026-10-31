/**
 * A typed phone number that finds the saved one however it was written: "0612345678" finds
 * "06 12 34 56 78", "+212 6 12-34-56-78" or "0612.34.56.78". Only for searches that look like a
 * phone (6+ digits and nothing but digits, spaces, +, dots, dashes); otherwise null.
 */
export function phoneSearchRegex(query: string): RegExp | null {
  const q = query.trim();
  if (!/^[\d\s+.\-()]+$/.test(q)) return null;
  let digits = q.replace(/\D/g, '');
  if (digits.length < 6) return null;
  // The number without the country code or the leading 0: 212 6… / 00212 6… / 06… → 6…
  if (digits.startsWith('00212')) digits = digits.slice(5);
  else if (digits.startsWith('212') && digits.length >= 11) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return new RegExp(digits.split('').join('[\\s.\\-()]*'));
}
