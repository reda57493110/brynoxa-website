/** Small round photo inside a sub-category chip (RAM shows RAM sticks…). */
export function SubThumb({ src }: { src?: string }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={24}
      height={24}
      className="-ms-1.5 me-1.5 size-5 shrink-0 rounded-full object-cover ring-1 ring-[var(--border)] sm:size-6"
    />
  )
}
