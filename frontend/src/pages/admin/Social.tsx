import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { SOCIAL_LINKS } from '@/lib/site'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PlatformStats, SocialOverview, SocialPlatform } from '@/types/social'

const LABEL: Record<SocialPlatform, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }
const COLOR: Record<SocialPlatform, string> = { facebook: '#3b82f6', instagram: '#ec4899', tiktok: '#22d3ee' }
/** Facebook and Instagram are connected together (one Meta Connect) */
const CONNECT_OF: Record<SocialPlatform, 'meta' | 'tiktok'> = { facebook: 'meta', instagram: 'meta', tiktok: 'tiktok' }

const compact = (n?: number) => (typeof n === 'number' ? new Intl.NumberFormat('en', { notation: n >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n) : '—')

/** After Connect, Meta / TikTok send the owner back with ?connected=… */
const RESULT: Record<string, { ok: boolean; text: string }> = {
  meta: { ok: true, text: 'Facebook and Instagram are connected.' },
  'meta-no-instagram': { ok: true, text: 'Facebook is connected. No Instagram business account is linked to this Page — link it in Instagram (Professional account → linked Page), then connect again.' },
  'meta-no-page': { ok: false, text: 'No Facebook Page was found on this account. Choose your Page when Facebook asks, then try again.' },
  'meta-cancelled': { ok: false, text: 'Facebook connection cancelled.' },
  'meta-failed': { ok: false, text: 'Facebook did not accept the connection. Check the setup guide (addresses and permissions) and try again.' },
  tiktok: { ok: true, text: 'TikTok is connected.' },
  'tiktok-cancelled': { ok: false, text: 'TikTok connection cancelled.' },
  'tiktok-failed': { ok: false, text: 'TikTok did not accept the connection. Check the setup guide and that your TikTok app is approved.' },
  expired: { ok: false, text: 'The connection took too long or was not started from this admin. Press Connect again.' },
}

/** Followers now vs N days ago, from the daily snapshots */
function change(growth: SocialOverview['growth'], platform: SocialPlatform, now: number | undefined, days: number) {
  if (typeof now !== 'number') return null
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const rows = growth.filter((g) => g.platform === platform)
  const then = rows.find((r) => r.day >= since)
  if (!then || then.day === rows[rows.length - 1]?.day) return null
  return now - then.followers
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null
  return (
    <span className={cn('text-[11px] font-semibold tabular-nums', value > 0 ? 'text-[var(--success)]' : value < 0 ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]')}>
      {value > 0 ? '+' : ''}
      {compact(value)} <span className="font-normal text-[var(--fg-muted)]">{label}</span>
    </span>
  )
}

function AccountCard({
  p,
  growth,
  canConnect,
  configured,
  onConnect,
  onDisconnect,
  connecting,
  profileLink,
}: {
  p: PlatformStats
  growth: SocialOverview['growth']
  canConnect: boolean
  configured: boolean
  onConnect: () => void
  onDisconnect: () => void
  connecting: boolean
  /** The page address from Settings → Contact & business (when not connected) */
  profileLink?: string
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-center gap-3">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-muted)]">
          {p.picture ? <img src={p.picture} alt="" className="h-full w-full object-cover" /> : null}
          <span className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: COLOR[p.platform] }}>
            <SocialGlyph id={p.platform} size={11} />
          </span>
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.connected ? p.name || LABEL[p.platform] : LABEL[p.platform]}</p>
          <p className="truncate text-xs text-[var(--fg-muted)]">{p.connected ? (p.username ? `@${p.username}` : 'Connected') : 'Not connected'}</p>
        </div>
      </div>

      {p.connected && !p.error ? (
        <>
          <p className="mt-4 font-display text-3xl font-bold tabular-nums">{compact(p.followers)}</p>
          <p className="text-xs text-[var(--fg-muted)]">followers</p>
          <div className="mt-1 flex flex-wrap gap-x-3">
            <Delta value={change(growth, p.platform, p.followers, 7)} label="7 days" />
            <Delta value={change(growth, p.platform, p.followers, 30)} label="30 days" />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3 text-center">
            {[
              ['Posts', p.posts ?? (p.recent.length ? `${p.recent.length}+` : undefined)],
              p.platform === 'tiktok' ? ['Likes', p.likes] : ['Reach 28d', p.reach28],
              ['Following', p.following],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-0">
                <dt className="truncate text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">{label}</dt>
                <dd className="truncate text-sm font-semibold tabular-nums">{typeof value === 'number' ? compact(value) : (value ?? '—')}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : p.connected && p.error ? (
        <p className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-2.5 text-xs text-[var(--danger)]">
          Could not read this account: {p.error}. {canConnect ? 'Connecting again usually fixes it.' : 'Ask the owner to connect it again.'}
        </p>
      ) : typeof p.followers === 'number' ? (
        <>
          <p className="mt-4 font-display text-3xl font-bold tabular-nums">{compact(p.followers)}</p>
          <p className="text-xs text-[var(--fg-muted)]">followers{typeof p.posts === 'number' ? ` · ${compact(p.posts)} posts` : ''}</p>
          <div className="mt-1 flex flex-wrap gap-x-3">
            <Delta value={change(growth, p.platform, p.followers, 7)} label="7 days" />
            <Delta value={change(growth, p.platform, p.followers, 30)} label="30 days" />
          </div>
          <p className="mt-2 text-[11px] text-[var(--fg-muted)]">Typed on {p.typedOn ? formatDate(p.typedOn) : '—'}</p>
        </>
      ) : (
        <p className="mt-4 text-xs text-[var(--fg-muted)]">No numbers yet: press “Update my numbers” and type your followers.</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {p.link || profileLink ? (
          <a href={p.link || profileLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-medium hover:border-[var(--brand)]">
            <SiteIcon name="external" size={12} /> Open
          </a>
        ) : null}
        {canConnect && configured && (p.platform !== 'instagram' || p.connected) ? (
          p.connected ? (
            p.platform === 'instagram' ? null : (
              <Button size="sm" variant="ghost" onClick={onDisconnect}>
                Disconnect
              </Button>
            )
          ) : (
            <Button size="sm" onClick={onConnect} loading={connecting}>
              Connect
            </Button>
          )
        ) : null}
        {p.connected && p.error && canConnect && configured ? (
          <Button size="sm" variant="outline" onClick={onConnect} loading={connecting}>
            Connect again
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Followers per day, one line per platform (from the daily snapshots) */
function GrowthChart({ growth }: { growth: SocialOverview['growth'] }) {
  const days = [...new Set(growth.map((g) => g.day))].sort()
  const platforms = (['facebook', 'instagram', 'tiktok'] as SocialPlatform[]).filter((p) => growth.some((g) => g.platform === p))
  if (days.length < 2) {
    return <p className="text-xs text-[var(--fg-muted)]">The chart appears once you have typed your numbers on two different days (e.g. once a week).</p>
  }
  const W = 600
  const H = 160
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs">
        {platforms.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR[p] }} /> {LABEL[p]}
          </span>
        ))}
        <span className="text-[var(--fg-muted)]">
          {formatDate(days[0])} → {formatDate(days[days.length - 1])}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Followers per day">
        {platforms.map((p) => {
          const rows = growth.filter((g) => g.platform === p)
          const min = Math.min(...rows.map((r) => r.followers))
          const max = Math.max(...rows.map((r) => r.followers))
          const span = Math.max(1, max - min)
          // Each platform on its own scale: the shape (growing or not) is what matters
          const pts = rows.map((r) => `${(days.indexOf(r.day) / (days.length - 1)) * W},${H - 8 - ((r.followers - min) / span) * (H - 16)}`)
          return <polyline key={p} points={pts.join(' ')} fill="none" stroke={COLOR[p]} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        })}
      </svg>
      <p className="text-[11px] text-[var(--fg-muted)]">Each line uses its own scale, to show whether each account is growing.</p>
    </div>
  )
}

function Posts({ platforms }: { platforms: PlatformStats[] }) {
  const withPosts = platforms.filter((p) => p.connected && p.recent.length)
  const [tab, setTab] = useState<SocialPlatform | null>(null)
  const active = withPosts.find((p) => p.platform === tab) ?? withPosts[0]
  if (!active) return <p className="text-xs text-[var(--fg-muted)]">Your latest posts show here once an account is connected.</p>
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {withPosts.map((p) => (
          <button
            key={p.platform}
            type="button"
            onClick={() => setTab(p.platform)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold',
              active.platform === p.platform ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] hover:border-[var(--brand)]'
            )}
          >
            <SocialGlyph id={p.platform} size={12} /> {LABEL[p.platform]}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {active.recent.map((post) => (
          <li key={post.id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            <a href={post.link} target="_blank" rel="noopener noreferrer" className="block">
              <div className="aspect-square bg-[var(--bg-muted)]">
                {post.image ? <img src={post.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 min-h-[2rem] text-xs">{post.text || <span className="text-[var(--fg-muted)]">No caption</span>}</p>
                <p className="mt-1 text-[10px] text-[var(--fg-muted)]">{post.at ? formatDate(post.at) : ''}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-2.5 text-[11px] font-semibold tabular-nums">
                  {typeof post.views === 'number' ? <span title="Views">▶ {compact(post.views)}</span> : null}
                  <span title="Likes / reactions">♥ {compact(post.likes)}</span>
                  <span title="Comments">💬 {compact(post.comments)}</span>
                  {post.shares ? <span title="Shares">↗ {compact(post.shares)}</span> : null}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Inbox({ platforms }: { platforms: PlatformStats[] }) {
  const qc = useQueryClient()
  const available = (['facebook', 'instagram'] as const).filter((p) => platforms.find((x) => x.platform === p)?.connected)
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>(available[0] ?? 'facebook')
  const [open, setOpen] = useState<{ id: string; name: string; customerId: string } | null>(null)
  const [text, setText] = useState('')
  const list = useQuery({
    queryKey: ['social-inbox', platform],
    queryFn: async () => (await adminApi.social.inbox(platform)).data.data,
    enabled: available.includes(platform),
    refetchInterval: 60_000,
  })
  const thread = useQuery({
    queryKey: ['social-thread', open?.id],
    queryFn: async () => (await adminApi.social.thread(open!.id)).data.data,
    enabled: Boolean(open),
    refetchInterval: 30_000,
  })
  const send = useMutation({
    mutationFn: () => adminApi.social.reply(open!.customerId, text.trim()),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['social-thread', open?.id] })
      qc.invalidateQueries({ queryKey: ['social-inbox', platform] })
      toast.success('Message sent')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (!available.length) return <p className="text-xs text-[var(--fg-muted)]">Connect Facebook to see your Facebook and Instagram messages here. TikTok does not share messages with other apps.</p>

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="mb-2 flex gap-2">
          {available.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlatform(p)
                setOpen(null)
              }}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold', platform === p ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)]')}
            >
              <SocialGlyph id={p} size={12} /> {LABEL[p]}
            </button>
          ))}
        </div>
        {list.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : list.isError ? (
          <p className="rounded-lg bg-[var(--bg-muted)] p-3 text-xs text-[var(--fg-muted)]">{getErrorMessage(list.error)}</p>
        ) : list.data?.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {list.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ id: c.id, name: c.name, customerId: c.customerId })}
                  className={cn('flex w-full items-start gap-2 px-3 py-2.5 text-start hover:bg-[var(--bg-muted)]', open?.id === c.id && 'bg-[var(--bg-muted)]')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('truncate text-sm', c.unread ? 'font-bold' : 'font-medium')}>{c.name}</span>
                      {c.unread ? <span className="rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-[var(--brand-fg)]">{c.unread}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {c.lastFromShop ? 'You: ' : ''}
                      {c.last || '…'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--fg-muted)]">{c.updatedAt ? formatDate(c.updatedAt) : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">No conversation.</p>
        )}
      </div>

      <div className="flex min-h-[18rem] min-w-0 flex-col rounded-xl border border-[var(--border)]">
        {!open ? (
          <p className="m-auto p-6 text-center text-xs text-[var(--fg-muted)]">Choose a conversation.</p>
        ) : (
          <>
            <p className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">{open.name}</p>
            <div className="flex max-h-[26rem] flex-1 flex-col gap-1.5 overflow-y-auto p-3">
              {thread.isLoading ? (
                <div className="m-auto"><Spinner /></div>
              ) : (
                (thread.data ?? []).map((m) => (
                  <div key={m.id} className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', m.fromShop ? 'ms-auto bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[var(--bg-muted)]')}>
                    <p className="whitespace-pre-line break-words">{m.text || <em className="opacity-70">(photo, sticker or attachment)</em>}</p>
                    <p className={cn('mt-0.5 text-[10px]', m.fromShop ? 'text-[var(--brand-fg)]/70' : 'text-[var(--fg-muted)]')}>{m.at ? formatDateTime(m.at) : ''}</p>
                  </div>
                ))
              )}
            </div>
            <form
              className="flex gap-2 border-t border-[var(--border)] p-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (text.trim()) send.mutate()
              }}
            >
              <input
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a reply…"
                className="h-10 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-4 text-sm outline-none ring-brand"
              />
              <Button type="submit" loading={send.isPending} disabled={!text.trim()}>
                Send
              </Button>
            </form>
            <p className="px-3 pb-2 text-[10px] text-[var(--fg-muted)]">Facebook and Instagram only allow a reply within 24 hours of the customer&apos;s last message.</p>
          </>
        )}
      </div>
    </div>
  )
}

function CopyLine({ value }: { value: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-[var(--bg-muted)] px-2 py-1 text-[11px]" title={value}>
        {value}
      </code>
      <button
        type="button"
        className="shrink-0 text-xs font-semibold text-[var(--brand-text)] hover:underline"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('Copied'), () => toast.error('Could not copy'))}
      >
        Copy
      </button>
    </span>
  )
}

/** What the owner does once in Meta / TikTok (their own developer apps) and in Vercel */
function SetupGuide({ setup, shop }: { setup: SocialOverview['setup']; shop: string }) {
  return (
    <Panel title="Setup (once)" description="Facebook, Instagram and TikTok only share your stats with an app you register with them. Free; about 15 minutes for Meta. TikTok reviews its apps (a few days or more).">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <SocialGlyph id="facebook" size={14} /> Facebook + Instagram {setup.meta.configured ? <span className="text-xs text-[var(--success)]">● ready{setup.meta.configId ? '' : ' (no Configuration ID yet)'}</span> : null}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-xs text-[var(--fg-muted)]">
            <li>
              In <b>Meta Business Suite</b> → Settings → Instagram accounts: check your Instagram is connected (a <b>Professional</b> account). If not, connect it there.
            </li>
            <li>
              Go to <b>developers.facebook.com</b> (same Facebook account) → My Apps → Create app → use case <b>Other</b> → type <b>Business</b> → link it to your <b>business portfolio</b> (the one in Business Suite).
            </li>
            <li>Add the products <b>Facebook Login for Business</b>, <b>Instagram</b> (API setup with Facebook login) and <b>Messenger</b>.</li>
            <li>
              Facebook Login for Business → Settings → Valid OAuth Redirect URIs: <CopyLine value={setup.meta.callbackUrl} />
            </li>
            <li>
              Facebook Login for Business → <b>Configurations</b> → Create: token type <b>User access token</b>, choose these permissions, then copy the <b>Configuration ID</b>:{' '}
              <span className="mt-1 block break-words font-mono text-[10px]">{setup.meta.scopes.join(', ')}</span>
            </li>
            <li>
              App settings → Basic: App domains <CopyLine value={new URL(shop).hostname} /> and add your Privacy policy address <CopyLine value={`${shop}/privacy`} />
            </li>
            <li>Copy the <b>App ID</b> and <b>App secret</b> (App settings → Basic).</li>
            <li>
              In Vercel → your project → Settings → Environment Variables, add <code>META_APP_ID</code>, <code>META_APP_SECRET</code> and <code>META_CONFIG_ID</code>, then redeploy. Never paste them anywhere else (not in a chat).
            </li>
            <li>Come back here and press <b>Connect</b> on Facebook. While the app stays in “Development” mode it works for you (admin of the app) — that is all this page needs.</li>
          </ol>
        </div>
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <SocialGlyph id="tiktok" size={14} /> TikTok {setup.tiktok.configured ? <span className="text-xs text-[var(--success)]">● ready</span> : null}
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-xs text-[var(--fg-muted)]">
            <li>
              Go to <b>developers.tiktok.com</b> → Manage apps → Connect an app (Web).
            </li>
            <li>
              Add <b>Login Kit</b> with the Redirect URI: <CopyLine value={setup.tiktok.callbackUrl} />
            </li>
            <li>
              Ask for the scopes <code>user.info.basic</code>, <code>user.info.profile</code>, <code>user.info.stats</code>, <code>video.list</code> (add <b>Display API</b>).
            </li>
            <li>Fill in the app details (website, Terms and Privacy pages) and submit it for review.</li>
            <li>
              Once approved: copy <b>Client key</b> and <b>Client secret</b> into Vercel as <code>TIKTOK_CLIENT_KEY</code> and <code>TIKTOK_CLIENT_SECRET</code>, then redeploy and press Connect.
            </li>
          </ol>
        </div>
      </div>
    </Panel>
  )
}

/** Official tools of each platform, where messages and full stats already live */
const SHORTCUTS: { group: string; items: { label: string; hint: string; href: string; icon: string }[] }[] = [
  {
    group: 'Messages',
    items: [
      { label: 'Facebook + Instagram inbox', hint: 'Meta Business Suite', href: 'https://business.facebook.com/latest/inbox/all', icon: 'facebook' },
      { label: 'TikTok messages', hint: 'TikTok', href: 'https://www.tiktok.com/messages', icon: 'tiktok' },
    ],
  },
  {
    group: 'Stats',
    items: [
      { label: 'Facebook + Instagram insights', hint: 'Meta Business Suite', href: 'https://business.facebook.com/latest/insights', icon: 'instagram' },
      { label: 'TikTok analytics', hint: 'TikTok Studio', href: 'https://www.tiktok.com/tiktokstudio/analytics', icon: 'tiktok' },
    ],
  },
  {
    group: 'Post',
    items: [
      { label: 'Plan a post', hint: 'Meta Business Suite → Planner', href: 'https://business.facebook.com/latest/content_calendar', icon: 'facebook' },
      { label: 'Upload a video', hint: 'TikTok Studio', href: 'https://www.tiktok.com/tiktokstudio/upload', icon: 'tiktok' },
    ],
  },
]

function Shortcuts() {
  return (
    <Panel title="Shortcuts" description="Your messages and full stats are in Meta Business Suite and TikTok Studio (also as phone apps). One click from here; they open in a new tab." compact>
      <div className="grid gap-4 sm:grid-cols-3">
        {SHORTCUTS.map((g) => (
          <div key={g.group} className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{g.group}</p>
            <ul className="space-y-1.5">
              {g.items.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2 transition hover:border-[var(--brand)]"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)]">
                      <SocialGlyph id={s.icon} size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.label}</span>
                      <span className="block truncate text-[11px] text-[var(--fg-muted)]">{s.hint}</span>
                    </span>
                    <SiteIcon name="external" size={12} className="shrink-0 text-[var(--fg-muted)]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  )
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Update my numbers: followers and posts of each account, for a day (today by default) */
function NumbersDialog({ open, onClose, last }: { open: boolean; onClose: () => void; last: PlatformStats[] }) {
  const qc = useQueryClient()
  const [day, setDay] = useState(todayIso())
  const [values, setValues] = useState<Record<SocialPlatform, { followers: string; posts: string }>>({
    facebook: { followers: '', posts: '' },
    instagram: { followers: '', posts: '' },
    tiktok: { followers: '', posts: '' },
  })
  useEffect(() => {
    if (open) setDay(todayIso())
  }, [open])
  const entries = (['facebook', 'instagram', 'tiktok'] as SocialPlatform[])
    .filter((p) => values[p].followers.trim() !== '')
    .map((p) => ({ platform: p, followers: Number(values[p].followers), posts: values[p].posts.trim() === '' ? undefined : Number(values[p].posts) }))
  const bad = entries.some((e) => !Number.isInteger(e.followers) || e.followers < 0 || (e.posts !== undefined && (!Number.isInteger(e.posts) || e.posts < 0)))
  const save = useMutation({
    mutationFn: () => adminApi.social.saveNumbers(day, entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social'] })
      toast.success('Numbers saved')
      setValues({ facebook: { followers: '', posts: '' }, instagram: { followers: '', posts: '' }, tiktok: { followers: '', posts: '' } })
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="Update my numbers">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (entries.length && !bad) save.mutate()
        }}
      >
        <p className="text-xs text-[var(--fg-muted)]">Type what each profile shows today (only the ones you want). Once a week is enough to see your growth.</p>
        <Input label="Day" type="date" value={day} max={todayIso()} onChange={(e) => setDay(e.target.value)} />
        {(['facebook', 'instagram', 'tiktok'] as SocialPlatform[]).map((p) => {
          const prev = last.find((x) => x.platform === p)
          return (
            <div key={p} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
              <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: COLOR[p] }}>
                <SocialGlyph id={p} size={14} />
              </span>
              <Input
                label={`${LABEL[p]} followers`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder={typeof prev?.followers === 'number' ? `last: ${prev.followers}` : 'e.g. 1520'}
                value={values[p].followers}
                onChange={(e) => setValues((v) => ({ ...v, [p]: { ...v[p], followers: e.target.value } }))}
              />
              <Input
                label="Posts (optional)"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder={typeof prev?.posts === 'number' ? `last: ${prev.posts}` : ''}
                value={values[p].posts}
                onChange={(e) => setValues((v) => ({ ...v, [p]: { ...v[p], posts: e.target.value } }))}
              />
            </div>
          )
        })}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!entries.length || bad}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** The numbers typed so far (to correct a mistake) */
function TypedHistory({ rows }: { rows: SocialOverview['typed'] }) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: (r: { platform: string; day: string }) => adminApi.social.deleteNumbers(r.platform, r.day),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social'] })
      toast.success('Removed')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  if (!rows.length) return null
  return (
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Numbers typed ({rows.length})</summary>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <li key={`${r.platform}-${r.day}`} className="flex items-center gap-3 py-1.5">
            <SocialGlyph id={r.platform} size={13} />
            <span className="w-24 shrink-0 text-xs text-[var(--fg-muted)]">{formatDate(r.day)}</span>
            <span className="min-w-0 flex-1 text-xs tabular-nums">
              {compact(r.followers)} followers{typeof r.posts === 'number' ? ` · ${compact(r.posts)} posts` : ''}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate({ platform: r.platform, day: r.day })}
              aria-label={`Remove ${LABEL[r.platform]} ${r.day}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
            >
              <SiteIcon name="trash" size={13} />
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Admin → Social media: followers, growth, latest posts and Facebook / Instagram messages */
export function Social() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const role = useAuthStore((s) => s.user?.role)
  const canConnect = hasPermission(role, 'settings')
  const [tab, setTab] = useState<'posts' | 'messages'>('posts')
  const [confirmOff, setConfirmOff] = useState<'meta' | 'tiktok' | null>(null)
  const [numbersOpen, setNumbersOpen] = useState(false)

  const overview = useQuery({
    queryKey: ['admin-social'],
    queryFn: async () => (await adminApi.social.overview()).data.data,
    staleTime: 5 * 60_000,
  })

  // Back from Meta / TikTok: say how it went, once
  const result = params.get('connected')
  useEffect(() => {
    if (!result) return
    const r = RESULT[result]
    if (r) (r.ok ? toast.success : toast.error)(r.text)
    params.delete('connected')
    setParams(params, { replace: true })
    qc.invalidateQueries({ queryKey: ['admin-social'] })
  }, [result, params, setParams, qc])

  const connect = useMutation({
    mutationFn: (platform: 'meta' | 'tiktok') => adminApi.social.connect(platform),
    onSuccess: (r) => {
      window.location.assign(r.data.data.url)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const disconnect = useMutation({
    mutationFn: (platform: 'meta' | 'tiktok') => adminApi.social.disconnect(platform),
    onSuccess: () => {
      setConfirmOff(null)
      qc.invalidateQueries({ queryKey: ['admin-social'] })
      toast.success('Disconnected')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const data = overview.data
  const shop = useMemo(() => window.location.origin, [])
  const needSetup = data && (!data.setup.meta.configured || !data.setup.tiktok.configured)
  const anyConnected = data?.platforms.some((p) => p.connected)

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Social media"
        description="Your Facebook, Instagram and TikTok in one place: followers, growth, latest posts and messages."
        actions={
          <Button onClick={() => setNumbersOpen(true)}>
            <SiteIcon name="pencil" size={14} /> Update my numbers
          </Button>
        }
      />

      {overview.isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : overview.isError || !data ? (
        <QueryErrorState onRetry={() => overview.refetch()} />
      ) : (
        <>
          <Shortcuts />

          <div className="grid gap-3 md:grid-cols-3">
            {data.platforms.map((p) => (
              <AccountCard
                key={p.platform}
                p={p}
                growth={data.growth}
                canConnect={canConnect}
                configured={CONNECT_OF[p.platform] === 'meta' ? data.setup.meta.configured : data.setup.tiktok.configured}
                connecting={connect.isPending && connect.variables === CONNECT_OF[p.platform]}
                onConnect={() => connect.mutate(CONNECT_OF[p.platform])}
                onDisconnect={() => setConfirmOff(CONNECT_OF[p.platform])}
                profileLink={SOCIAL_LINKS.find((s) => s.id === p.platform)?.href}
              />
            ))}
          </div>

          <Panel title="Followers over time">
            <GrowthChart growth={data.growth} />
          </Panel>

          <TypedHistory rows={data.typed ?? []} />

          {anyConnected ? (
            <section className="space-y-3">
              <div role="tablist" className="flex gap-2">
                {(['posts', 'messages'] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn('h-9 rounded-full border px-4 text-sm font-semibold', tab === t ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] hover:border-[var(--brand)]')}
                  >
                    {t === 'posts' ? 'Latest posts' : 'Messages'}
                  </button>
                ))}
              </div>
              {tab === 'posts' ? <Posts platforms={data.platforms} /> : <Inbox platforms={data.platforms} />}
            </section>
          ) : null}

          {/* Optional, for later: live numbers and the inbox inside the admin (needs a Meta / TikTok developer app) */}
          {needSetup && canConnect ? (
            <details className="rounded-2xl border border-dashed border-[var(--border)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">Connect automatically (advanced, optional)</summary>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                Not needed: the shortcuts and your numbers work without it. Only if one day you want live numbers and the inbox inside this admin.
              </p>
              <div className="mt-3">
                <SetupGuide setup={data.setup} shop={shop} />
              </div>
            </details>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmOff)}
        title={confirmOff === 'meta' ? 'Disconnect Facebook and Instagram?' : 'Disconnect TikTok?'}
        description="The admin stops reading this account. Your growth history is kept. You can connect again any time."
        confirmLabel="Disconnect"
        loading={disconnect.isPending}
        onClose={() => setConfirmOff(null)}
        onConfirm={() => confirmOff && disconnect.mutate(confirmOff)}
      />
      {data ? <NumbersDialog open={numbersOpen} onClose={() => setNumbersOpen(false)} last={data.platforms} /> : null}
    </div>
  )
}
