import { Providers } from '@/app/providers'
import { AppRouter } from '@/app/router'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { NetworkProgress } from '@/components/ui/NetworkProgress'

export default function App() {
  return (
    <Providers>
      <ErrorBoundary>
        <NetworkProgress />
        <AppRouter />
      </ErrorBoundary>
    </Providers>
  )
}
