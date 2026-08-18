import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ContactInfoCard } from '@/components/contact/ContactInfoCard'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { contactApi } from '@/api/contactApi'
import { getErrorMessage } from '@/api/client'
import { CONTACT, CONTACT_FAQS, SOCIAL_LINKS } from '@/lib/site'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'

const SUBJECT_PRESETS = ['Order help', 'Warranty', 'Return', 'Product advice', 'Bulk / business'] as const

const HERO_PROOF = [
  { icon: 'chat', label: 'WhatsApp first' },
  { icon: 'clock', label: 'Same business day' },
  { icon: 'truck', label: 'Ships across Morocco' },
] as const

const pillPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

const pillGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-5 text-base font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

type FormErrors = Partial<Record<'name' | 'email' | 'subject' | 'message', string>>

function fadeIn(reduce: boolean | null, delay = 0) {
  if (reduce) return { initial: false as const, animate: { opacity: 1 } }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
  }
}

export function Contact() {
  const reduceMotion = useReducedMotion()
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')

  const [newsEmail, setNewsEmail] = useState('')
  const [newsError, setNewsError] = useState('')
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsDone, setNewsDone] = useState(false)

  useEffect(() => {
    const prev = document.title
    document.title = 'Contact — Brynoxa'
    return () => {
      document.title = prev
    }
  }, [])

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (name.trim().length < 2) next.name = 'Please enter your full name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email'
    if (subject.trim().length < 3) next.subject = 'Subject is required'
    if (message.trim().length < 10) next.message = 'Message should be at least 10 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSent(false)
    if (!validate()) return

    setSending(true)
    try {
      await contactApi.sendMessage({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      })
      setSent(true)
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
      setErrors({})
      toast.success('Message sent — we will reply soon')
    } catch (err) {
      const msg = getErrorMessage(err, 'Could not send your message')
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const onNewsletter = async (e: FormEvent) => {
    e.preventDefault()
    setNewsError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsEmail.trim())) {
      setNewsError('Enter a valid email address')
      return
    }
    setNewsLoading(true)
    try {
      await contactApi.subscribe(newsEmail.trim())
      setNewsDone(true)
      setNewsEmail('')
      toast.success('You are subscribed')
    } catch (err) {
      const msg = getErrorMessage(err, 'Subscription failed')
      setNewsError(msg)
      toast.error(msg)
    } finally {
      setNewsLoading(false)
    }
  }

  return (
    <>
      <section aria-labelledby="contact-hero-title" className="page-hero">
        <Container className="relative py-12 sm:py-16">
          <motion.div {...fadeIn(reduceMotion)}>
            <p className="kicker">Contact</p>
            <h1
              id="contact-hero-title"
              className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              Contact us
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              Orders, warranty, or a product question — WhatsApp is fastest. The form reaches the same team.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={CONTACT.whatsapp.href} target="_blank" rel="noopener noreferrer" className={pillPrimary}>
                WhatsApp
                <SiteIcon name="arrow-right" size={16} />
              </a>
              <a href="#message" className={pillGhost}>
                Send a message
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2">
              {HERO_PROOF.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-sm text-[var(--fg)]"
                >
                  <SiteIcon name={icon} size={14} className="text-[var(--brand)]" />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </Container>
      </section>

      <section aria-labelledby="contact-info-heading" className="py-14 sm:py-16">
        <Container>
          <div className="mb-8 max-w-xl">
            <p className="kicker">
              Hours & channels
            </p>
            <h2
              id="contact-info-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              WhatsApp, phone, or email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              We deliver across Morocco. There is no walk-in shop.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContactInfoCard
              icon={<SiteIcon name="chat" size={20} />}
              label={CONTACT.whatsapp.label}
              value={CONTACT.whatsapp.value}
              href={CONTACT.whatsapp.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="phone" size={20} />}
              label={CONTACT.phone.label}
              value={CONTACT.phone.value}
              href={CONTACT.phone.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="mail" size={20} />}
              label={CONTACT.email.label}
              value={CONTACT.email.value}
              href={CONTACT.email.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="clock" size={20} />}
              label={CONTACT.hours.label}
              value={CONTACT.hours.value}
            />
          </div>
        </Container>
      </section>

      <section
        id="message"
        aria-labelledby="contact-form-heading"
        className="scroll-mt-[calc(var(--nav-height)+1rem)] border-t border-[var(--border)] bg-[var(--bg-elevated)] py-14 sm:py-16"
      >
        <Container>
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-3">
              <p className="kicker">
                Message
              </p>
              <h2
                id="contact-form-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Send a message
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                Include your order number if you have one. We usually reply within one business day.
              </p>

              {sent ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 flex items-start gap-3 rounded-[1.35rem] border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg))] p-5"
                  role="status"
                >
                  <SiteIcon name="check" size={18} className="mt-0.5 shrink-0 text-[var(--success)]" />
                  <div>
                    <p className="font-semibold">Message received</p>
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">
                      Thanks for writing. Support will get back to you shortly.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-full"
                      onClick={() => setSent(false)}
                    >
                      Send another message
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSubject(preset)}
                        className={cn(
                          'h-8 rounded-full border px-3 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                          subject === preset
                            ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={errors.name}
                      required
                      aria-invalid={Boolean(errors.name)}
                    />
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={errors.email}
                      required
                      aria-invalid={Boolean(errors.email)}
                    />
                  </div>
                  <Input
                    label="Subject"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    error={errors.subject}
                    required
                    aria-invalid={Boolean(errors.subject)}
                  />
                  <Textarea
                    label="Message"
                    name="message"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    error={errors.message}
                    required
                    aria-invalid={Boolean(errors.message)}
                  />
                  {formError ? (
                    <p className="text-sm text-[var(--danger)]" role="alert">
                      {formError}
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" loading={sending} className="min-w-[10rem] rounded-full">
                    <SiteIcon name="send" size={16} />
                    Send message
                  </Button>
                </form>
              )}
            </div>

            <aside className="lg:col-span-2">
              <p className="kicker">
                Links
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Orders and policies</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                Track a shipment or read the policy first.
              </p>
              <ul className="mt-6 space-y-2">
                {[
                  { to: '/account/orders', label: 'Track my order' },
                  { to: '/services#warranty', label: 'Warranty' },
                  { to: '/services#returns', label: 'Returns' },
                  { to: '/shop', label: 'Browse the shop' },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
                    >
                      {item.label}
                      <SiteIcon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-sm font-semibold text-[var(--fg)]">Social</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SOCIAL_LINKS.map((s) => (
                    <a
                      key={s.id}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${s.name} — opens in a new tab`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    >
                      <SocialGlyph id={s.id} size={16} />
                    </a>
                ))}
              </div>
            </aside>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="contact-faq-heading"
        className="border-t border-[var(--border)] py-14 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="kicker">
              FAQ
            </p>
            <h2
              id="contact-faq-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Common questions
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">COD, returns, and cancellations.</p>
            <ul className="mt-8 space-y-3">
              {CONTACT_FAQS.map((item, i) => {
                const open = openFaq === i
                const panelId = `contact-faq-${i}`
                return (
                  <li
                    key={item.q}
                    className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)]"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span className="font-medium">{item.q}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 text-[var(--fg-muted)] transition duration-300',
                          open && 'rotate-180'
                        )}
                      >
                        <SiteIcon name="chevron-down" size={16} />
                      </span>
                    </button>
                    <div
                      id={panelId}
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-out',
                        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--fg-muted)]">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="newsletter-heading"
        className="border-t border-[var(--border)] py-16 sm:py-20"
      >
        <Container>
          <motion.div
            className="cta-band relative overflow-hidden rounded-[1.75rem] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <SiteIcon
              name="mail"
              size={96}
              className="pointer-events-none absolute -left-8 bottom-[-2rem] text-[var(--brand)] opacity-[0.12]"
            />
            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_min(22rem,100%)] lg:gap-16">
              <div>
                <p className="kicker">
                  Newsletter
                </p>
                <h2
                  id="newsletter-heading"
                  className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  New stock and restocks
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  Occasional emails when hardware lands. No daily noise.
                </p>
              </div>
              <div>
                {newsDone ? (
                  <p className="text-sm font-medium text-[var(--brand-text)]" role="status">
                    You’re subscribed.
                  </p>
                ) : (
                  <form onSubmit={onNewsletter} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
                    <div className="flex-1 text-left">
                      <label htmlFor="newsletter-email" className="sr-only">
                        Email for newsletter
                      </label>
                      <input
                        id="newsletter-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@email.com"
                        value={newsEmail}
                        onChange={(e) => setNewsEmail(e.target.value)}
                        aria-invalid={Boolean(newsError)}
                        className={cn(
                          'h-12 w-full rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-5 text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none transition ring-brand',
                          newsError && 'border-[var(--danger)]'
                        )}
                      />
                      {newsError ? (
                        <p className="mt-1.5 px-2 text-xs text-[var(--danger)]" role="alert">
                          {newsError}
                        </p>
                      ) : null}
                    </div>
                    <Button type="submit" size="lg" loading={newsLoading} className="rounded-full sm:min-w-[8.5rem]">
                      Subscribe
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
