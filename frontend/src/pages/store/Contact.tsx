import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { m, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { ContactInfoCard } from '@/components/contact/ContactInfoCard'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { contactApi } from '@/api/contactApi'
import { getErrorMessage } from '@/api/client'
import { PhoneText } from '@/components/ui/PhoneText'
import { CONTACT, SOCIAL_LINKS } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { toast } from '@/store/toastStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { cn } from '@/lib/cn'
import { PageBand, bandPrimaryPill, pagePanel } from '@/components/layout/PageBand'
import { HomeSectionHead } from '@/components/home/HomeShelf'

const CONTACT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=2560&q=80'

type FormErrors = Partial<Record<'name' | 'email' | 'subject' | 'message', string>>

export function Contact() {
  const reduceMotion = useReducedMotion()
  const { contact } = useMessages()
  const t = useT()
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)

  const SUBJECT_PRESETS = [
    t('contact.subjectOrder'),
    t('contact.subjectWarranty'),
    t('contact.subjectReturn'),
    t('contact.subjectAdvice'),
    t('contact.subjectBulk'),
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

  useSeo({
    title: t('meta.contactTitle'),
    description: t('meta.contactDescription'),
    path: '/contact',
  })

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
      <div className="pt-2 sm:pt-4">
        <PageBand
          crumbs={[{ label: t('common.contact') }]}
          titleId="contact-hero-title"
          image={CONTACT_HERO_IMAGE}
          imagePosition="object-[50%_45%]"
          kicker={t('contact.heroKicker')}
          title={t('contact.heroTitle')}
          accent={t('contact.heroTitleAccent')}
          body={t('contact.heroBody')}
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => openWhatsAppPicker()} className={bandPrimaryPill}>
              <SiteIcon name="chat" size={17} />
              {t('contact.whatsapp')}
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/85 sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
              </span>
              {contact.heroSupportChip}
            </span>
          </div>
        </PageBand>
      </div>

      <section
        id="message"
        aria-labelledby="contact-form-heading"
        className="scroll-mt-[calc(var(--nav-height)+1rem)] pt-3 sm:pt-5"
      >
        <Container>
          <div className="grid items-start gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className={pagePanel}>
              <HomeSectionHead id="contact-form-heading" title={t('contact.sendMessage')} body={t('contact.formBody')} />

              <div>
                {sent ? (
                  <m.div
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-start gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--bg-elevated))] p-4 sm:p-5"
                    role="status"
                  >
                    <SiteIcon name="check" size={18} className="mt-0.5 shrink-0 text-[var(--success)]" />
                    <div>
                      <p className="font-semibold">{t('contact.received')}</p>
                      <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('contact.receivedBody')}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 rounded-full"
                        onClick={() => setSent(false)}
                      >
                        {t('contact.sendAnother')}
                      </Button>
                    </div>
                  </m.div>
                ) : (
                  <form
                    className="space-y-3.5 sm:space-y-4"
                    onSubmit={onSubmit}
                    noValidate
                  >
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
                    <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
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
                      rows={5}
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
                    <Button type="submit" size="lg" loading={sending} className="w-full rounded-full sm:w-auto">
                      <SiteIcon name="send" size={16} />
                      {t('contact.send')}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <aside className={cn(pagePanel, 'space-y-3 sm:space-y-4 lg:sticky lg:top-24')} aria-labelledby="contact-info-heading">
              <div>
                <HomeSectionHead id="contact-info-heading" title={t('contact.channelsTitle')} className="mb-1 sm:mb-2" />
                <p className="text-[13px] leading-relaxed text-[var(--fg-muted)] sm:text-sm">{t('contact.noShop')}</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                <ContactInfoCard
                  icon={<SiteIcon name="chat" size={18} />}
                  label={t('contact.whatsapp')}
                  value={<PhoneText>{CONTACT.whatsapp.value}</PhoneText>}
                  onClick={() => openWhatsAppPicker()}
                />
                <ContactInfoCard
                  icon={<SiteIcon name="phone" size={18} />}
                  label={t('contact.phone')}
                  value={<PhoneText>{CONTACT.phone.value}</PhoneText>}
                  href={CONTACT.phone.href}
                />
                <ContactInfoCard
                  icon={<SiteIcon name="mail" size={18} />}
                  label={t('contact.email')}
                  value={CONTACT.email.value}
                  href={CONTACT.email.href}
                />
                <ContactInfoCard
                  icon={<SiteIcon name="clock" size={18} />}
                  label={t('contact.hours')}
                  value={t('contact.hoursValue')}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--fg)]">{t('contact.social')}</p>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_LINKS.map((s) =>
                    s.id === 'whatsapp' ? (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => openWhatsAppPicker()}
                        aria-label={t('nav.socialOpens', { name: s.name })}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                      >
                        <SocialGlyph id={s.id} size={16} />
                      </button>
                    ) : (
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
                    )
                  )}
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* Common questions live in the Help Center (no second FAQ here) */}
      <section aria-label={t('help.kicker')} className="pt-3 sm:pt-5">
        <Container>
          <Link
            to="/help"
            className="group flex items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 text-sm font-bold transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:rounded-2xl sm:px-6 sm:py-4"
          >
            <span className="inline-flex items-center gap-2.5">
              <SiteIcon name="help" size={17} className="text-[var(--brand-text)]" />
              {t('contact.helpLine')}
            </span>
            <SiteIcon name="arrow-right" size={16} className="shrink-0 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </Container>
      </section>

      <section aria-labelledby="newsletter-heading" className="pb-8 pt-3 sm:pb-12 sm:pt-5">
        <Container>
          <m.div
            className="relative overflow-hidden rounded-[1.25rem] border border-[rgb(0_194_255/0.3)] bg-[linear-gradient(110deg,rgb(0_194_255/0.16),rgb(0_194_255/0.04)_55%,transparent)] px-4 py-5 sm:rounded-[2rem] sm:px-8 sm:py-8 lg:px-10"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_min(26rem,100%)] lg:gap-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-text)] sm:text-xs">{t('contact.newsletter')}</p>
                <h2
                  id="newsletter-heading"
                  className="mt-1 font-display text-[15px] font-extrabold uppercase leading-tight tracking-tight sm:mt-1.5 sm:text-2xl"
                >
                  {t('contact.newsTitle')}
                </h2>
                <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  {t('contact.newsBody')}
                </p>
              </div>
              <div>
                {newsDone ? (
                  <p className="text-sm font-medium text-[var(--brand-text)]" role="status">
                    {t('contact.subscribed')}
                  </p>
                ) : (
                  <form
                    onSubmit={onNewsletter}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start"
                    noValidate
                  >
                    <div className="flex-1 text-start">
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
                    <Button
                      type="submit"
                      size="lg"
                      loading={newsLoading}
                      className="w-full rounded-full sm:w-auto sm:min-w-[8.5rem]"
                    >
                      {t('contact.subscribe')}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </m.div>
        </Container>
      </section>
    </>
  )
}
