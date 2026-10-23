/**
 * Addresses sent to analytics without secret values. Kept free of imports so tests can load it.
 */
/** Query values that must never leave the site (sign-in / reset / verification keys). */
const SECRET_PARAMS = /^(token|code|key|secret|password|reset|verify|receipt|auth|session|t)$/i

/** The address without secret values, e.g. "/reset-password?token=…" → "/reset-password". */
export function safePath(pathAndQuery: string) {
  const [path, query = ''] = pathAndQuery.split('?')
  const params = new URLSearchParams(query)
  for (const key of [...params.keys()]) if (SECRET_PARAMS.test(key)) params.delete(key)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
