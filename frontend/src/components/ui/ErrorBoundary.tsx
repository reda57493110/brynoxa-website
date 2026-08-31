import { Component, type ErrorInfo, type ReactNode } from 'react'
import { SiteIcon } from './SiteIcon'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info)
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 text-[var(--fg)]">
        <section
          role="alert"
          className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center shadow-soft-lg sm:p-8"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--danger)]">
            <SiteIcon name="alert" size={24} />
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
            The page could not be displayed. Refresh and try again.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <SiteIcon name="refresh" size={16} />
            Refresh page
          </button>
        </section>
      </main>
    )
  }
}
