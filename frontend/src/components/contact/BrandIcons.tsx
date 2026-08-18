import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function StrokeIcon({
  size = 22,
  children,
  className,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function WhatsAppIcon({ size = 22, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M19.11 4.89A9.86 9.86 0 0 0 12.05 2C6.48 2 1.96 6.52 1.96 12.08c0 1.78.46 3.51 1.35 5.04L2 22l5.02-1.32a10.07 10.07 0 0 0 5.03 1.28h.01c5.56 0 10.08-4.52 10.08-10.08 0-2.7-1.05-5.23-2.97-7.15zM12.06 20.13h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-2.98.78.8-2.9-.2-.3a8.25 8.25 0 0 1-1.27-4.4c0-4.56 3.71-8.27 8.28-8.27 2.21 0 4.29.86 5.85 2.43a8.22 8.22 0 0 1 2.42 5.85c0 4.56-3.72 8.27-8.36 8.27zm4.54-6.2c-.25-.12-1.47-.73-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42-.14 0-.31 0-.48 0-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  )
}

export function FacebookIcon({ size = 22, className, ...props }: IconProps) {
  return (
    <StrokeIcon size={size} className={className} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </StrokeIcon>
  )
}

export function InstagramIcon({ size = 22, className, ...props }: IconProps) {
  return (
    <StrokeIcon size={size} className={className} {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

export function SocialGlyph({
  id,
  size = 16,
}: {
  id: string
  size?: number
}) {
  if (id === 'whatsapp') return <WhatsAppIcon size={size} />
  if (id === 'facebook') return <FacebookIcon size={size} />
  if (id === 'instagram') return <InstagramIcon size={size} />
  return null
}
