import { cn } from '@/lib/cn'

/** Keeps Latin digits (phone numbers) in visual LTR order on RTL pages. */
export function PhoneText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <bdi dir="ltr" className={cn(className)}>
      {children}
    </bdi>
  )
}
