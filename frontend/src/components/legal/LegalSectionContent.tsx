import type { LegalSection } from '@/lib/legal'
import { CONTACT } from '@/lib/site'

/** Keeps emails and phone numbers left-to-right inside Arabic sentences. */
const isolate = (value: string) => `⁦${value}⁩`

const fill = (text: string) =>
  text
    .replaceAll('{email}', isolate(CONTACT.email.value))
    .replaceAll('{phone}', isolate(CONTACT.phone.value))

/** Paragraphs and bullet list of one legal section (heading rendered by the caller). */
export function LegalSectionContent({ section }: { section: LegalSection }) {
  return (
    <>
      {section.paragraphs?.map((p) => (
        <p key={p} className="mt-3 text-sm leading-relaxed text-[var(--fg)]/85 sm:text-[15px] sm:leading-7">
          {fill(p)}
        </p>
      ))}
      {section.list ? (
        <ul className="mt-3 space-y-2">
          {section.list.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 text-sm leading-relaxed text-[var(--fg)]/85 sm:text-[15px] sm:leading-7"
            >
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
              <span>{fill(item)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
