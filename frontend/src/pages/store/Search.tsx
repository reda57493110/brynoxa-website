import { Navigate, useSearchParams } from 'react-router-dom'

/** Search now lives on /shop?q= so filters and sort stay available. */
export function Search() {
  const [params] = useSearchParams()
  const q = params.get('q')?.trim()
  return <Navigate to={q ? `/shop?q=${encodeURIComponent(q)}` : '/shop'} replace />
}
