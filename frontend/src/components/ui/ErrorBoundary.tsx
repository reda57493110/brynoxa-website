import { Component, type ErrorInfo, type ReactNode } from 'react'
import { SiteIcon } from './SiteIcon'
import { translate, type MessageKey } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import { isChunkLoadError, reloadForNewVersion } from '@/lib/newVersion'

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
    // A page's code from the previous version is gone after a deploy: load the new version
    if (isChunkLoadError(error) && reloadForNewVersion()) return
    console.error('Unhandled application error', error, info)
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    // A class component (no hooks): the language is read from the store directly
    const text = (key: MessageKey) => translate(useLocaleStore.getState().locale, key)

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10 text-[var(--fg)]">
        <section
          role="alert"
          className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center shadow-soft-lg sm:p-8"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--danger)]">
            <SiteIcon name="alert" size={24} />
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold">{text('errorPage.title')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
            {text('errorPage.body')}
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <SiteIcon name="refresh" size={16} />
            {text('errorPage.refresh')}
          </button>
        </section>
      </main>
    )
  }
}
