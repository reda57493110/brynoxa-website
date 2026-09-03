import { Providers } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export default function App() {
  return (
    <Providers>
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </Providers>
  )
}
