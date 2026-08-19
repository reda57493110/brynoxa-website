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
import { CONTACT, SOCIAL_LINKS } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'

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
  const { contact } = useMessages()
  const t = useT()
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const SUBJECT_PRESETS = [
    t('contact.subjectOrder'),
    t('contact.subjectWarranty'),
    t('contact.subjectReturn'),
    t('contact.subjectAdvice'),
    t('contact.subjectBulk'),
  ]

  const HERO_PROOF = [
    { icon: 'chat' as const, label: t('contact.proofWhatsapp') },
    { icon: 'clock' as const, label: t('contact.proofSameDay') },
    { icon: 'truck' as const, label: t('home.proofShip') },
  ]

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
    document.title = t('meta.contactTitle')
    return () => {
      document.title = prev
    }
  }, [t])

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (name.trim().length < 2) next.name = t('contact.errName')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('contact.errEmail')
    if (subject.trim().length < 3) next.subject = t('contact.errSubject')
    if (message.trim().length < 10) next.message = t('contact.errMessage')
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
      toast.success(t('contact.sentToast'))
    } catch (err) {
      const msg = getErrorMessage(err, t('contact.sendFail'))
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
      setNewsError(t('contact.errNewsEmail'))
      return
    }
    setNewsLoading(true)
    try {
      await contactApi.subscribe(newsEmail.trim())
      setNewsDone(true)
      setNewsEmail('')
      toast.success(t('contact.subscribeToast'))
    } catch (err) {
      const msg = getErrorMessage(err, t('contact.subscribeFail'))
      setNewsError(msg)
      toast.error(msg)
    } finally {
      setNewsLoading(false)
    }
  }

  return (
    <>
      <section aria-labelledby="contact-hero-title" className="page-hero">
        <Container className="relative py-8 sm:py-10">
          <motion.div {...fadeIn(reduceMotion)}>
            <p className="kicker">{t('contact.heroKicker')}</p>
            <h1
              id="contact-hero-title"
              className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              {t('contact.heroTitle')}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              {t('contact.heroBody')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={CONTACT.whatsapp.href} target="_blank" rel="noopener noreferrer" className={pillPrimary}>
                {t('contact.whatsapp')}
                <SiteIcon name="arrow-right" size={16} />
              </a>
              <a href="#message" className={pillGhost}>
                {t('contact.sendMessage')}
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

      <section aria-labelledby="contact-info-heading" className="py-8 sm:py-10">
        <Container>
          <div className="mb-8 max-w-xl">
            <p className="kicker">
              {t('contact.hoursChannels')}
            </p>
            <h2
              id="contact-info-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('contact.channelsTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              {t('contact.noShop')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContactInfoCard
              icon={<SiteIcon name="chat" size={20} />}
              label={t('contact.whatsapp')}
              value={CONTACT.whatsapp.value}
              href={CONTACT.whatsapp.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="phone" size={20} />}
              label={t('contact.phone')}
              value={CONTACT.phone.value}
              href={CONTACT.phone.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="mail" size={20} />}
              label={t('contact.email')}
              value={CONTACT.email.value}
              href={CONTACT.email.href}
            />
            <ContactInfoCard
              icon={<SiteIcon name="clock" size={20} />}
              label={t('contact.hours')}
              value={t('contact.hoursValue')}
            />
          </div>
        </Container>
      </section>

      <section
        id="message"
        aria-labelledby="contact-form-heading"
        className="scroll-mt-[calc(var(--nav-height)+1rem)] bg-[var(--bg-elevated)] py-8 sm:py-10"
      >
        <Container>
          <div className="grid gap-10 lg:grid-cols-5 lg:gap-14">
            <div className="lg:col-span-3">
              <p className="kicker">
                {t('contact.messageKicker')}
              </p>
              <h2
                id="contact-form-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                {t('contact.sendMessage')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('contact.formBody')}
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
                    <p className="font-semibold">{t('contact.received')}</p>
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">
                      {t('contact.receivedBody')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-full"
                      onClick={() => setSent(false)}
                    >
                      {t('contact.sendAnother')}
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
                      label={t('contact.fullName')}
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={errors.name}
                      required
                      aria-invalid={Boolean(errors.name)}
                    />
                    <Input
                      label={t('contact.email')}
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
                    label={t('contact.subject')}
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    error={errors.subject}
                    required
                    aria-invalid={Boolean(errors.subject)}
                  />
                  <Textarea
                    label={t('contact.message')}
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
                    {t('contact.send')}
                  </Button>
                </form>
              )}
            </div>

            <aside className="lg:col-span-2">
              <p className="kicker">
                {t('contact.linksKicker')}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{t('contact.policiesTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                {t('contact.policiesBody')}
              </p>
              <ul className="mt-6 space-y-2">
                {[
                  { to: '/account/orders', label: t('contact.trackOrder') },
                  { to: '/services#warranty', label: t('footer.warranty') },
                  { to: '/services#returns', label: t('footer.returns') },
                  { to: '/shop', label: t('contact.browseShop') },
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

              <p className="mt-8 text-sm font-semibold text-[var(--fg)]">{t('contact.social')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SOCIAL_LINKS.map((s) => (
                    <a
                      key={s.id}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('nav.socialOpens', { name: s.name })}
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
        className="py-8 sm:py-10"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="kicker">
              {t('ui.faq')}
            </p>
            <h2
              id="contact-faq-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('ui.commonQuestions')}
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-muted)]">{t('contact.faqBody')}</p>
            <ul className="mt-8 space-y-3">
              {contact.faqs.map((item, i) => {
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
        className="pb-12 pt-8 sm:pb-14 sm:pt-10"
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
                  {t('contact.newsletter')}
                </p>
                <h2
                  id="newsletter-heading"
                  className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  {t('contact.newsTitle')}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  {t('contact.newsBody')}
                </p>
              </div>
              <div>
                {newsDone ? (
                  <p className="text-sm font-medium text-[var(--brand-text)]" role="status">
                    {t('contact.subscribed')}
                  </p>
                ) : (
                  <form onSubmit={onNewsletter} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
                    <div className="flex-1 text-left">
                      <label htmlFor="newsletter-email" className="sr-only">
                        {t('contact.newsEmail')}
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
                      {t('contact.subscribe')}
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
