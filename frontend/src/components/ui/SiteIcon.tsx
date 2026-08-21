import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Banknote,
  Boxes,
  Cable,
  Check,
  Clock,
  Cpu,
  ExternalLink,
  Gamepad2,
  Headphones,
  Heart,
  Home,
  Inbox,
  Keyboard,
  Laptop,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  Mouse,
  Package,
  PackageCheck,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Sun,
  Tag,
  Ticket,
  Trash2,
  Truck,
  User,
  Users,
  Warehouse,
  Wifi,
  Wrench,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { FacebookIcon, InstagramIcon } from '@/components/contact/BrandIcons'

const ICONS = {
  alert: AlertTriangle,
  armchair: Armchair,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  banknote: Banknote,
  boxes: Boxes,
  cable: Cable,
  cart: ShoppingBag,
  chat: MessageCircle,
  check: Check,
  chevron: ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  clock: Clock,
  close: X,
  cpu: Cpu,
  dashboard: LayoutDashboard,
  external: ExternalLink,
  gamepad: Gamepad2,
  headphones: Headphones,
  heart: Heart,
  home: Home,
  inbox: Inbox,
  keyboard: Keyboard,
  laptop: Laptop,
  layers: Layers,
  logout: LogOut,
  mail: Mail,
  menu: Menu,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  mouse: Mouse,
  package: Package,
  'package-check': PackageCheck,
  'package-open': PackageOpen,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  refresh: RefreshCw,
  search: Search,
  send: Send,
  settings: Settings,
  shield: Shield,
  sliders: SlidersHorizontal,
  star: Star,
  sun: Sun,
  tag: Tag,
  ticket: Ticket,
  trash: Trash2,
  truck: Truck,
  user: User,
  users: Users,
  warehouse: Warehouse,
  wifi: Wifi,
  wrench: Wrench,
} as const satisfies Record<string, LucideIcon>

export type SiteIconName = keyof typeof ICONS | 'facebook' | 'instagram'

export function SiteIcon({
  name,
  size = 18,
  className,
  alt = '',
  solid = false,
}: {
  name: SiteIconName
  size?: number
  className?: string
  alt?: string
  solid?: boolean
}) {
  const shared = {
    className: cn('shrink-0', className),
    role: alt ? ('img' as const) : undefined,
    'aria-label': alt || undefined,
    'aria-hidden': alt ? undefined : true,
  }

  if (name === 'instagram') return <InstagramIcon size={size} {...shared} />
  if (name === 'facebook') return <FacebookIcon size={size} {...shared} />

  const Icon = ICONS[name]
  return (
    <Icon
      size={size}
      strokeWidth={solid ? 1.5 : 1.75}
      absoluteStrokeWidth
      fill={solid ? 'currentColor' : 'none'}
      {...shared}
    />
  )
}
