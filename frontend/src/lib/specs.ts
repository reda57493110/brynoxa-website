import type { Locale } from '@/i18n'

/**
 * Category-based product specifications.
 *
 * Every spec is one entry in `product.specs` (a key → string map in the database):
 * - template fields are stored under their field key (e.g. `ram_gb: "16"`), with the unit
 *   kept here so it is only added when displayed ("16 GB");
 * - custom specs (and older free-form specs) are stored under their own label.
 *
 * A template is the list of fields shown for one kind of product. The backend only knows the
 * template ids — keep SPEC_TEMPLATE_IDS in backend/src/utils/specs.ts in sync.
 */

export type SpecFieldType = 'text' | 'number' | 'select' | 'combo' | 'multi' | 'bool'
type L = { en: string; fr: string; ar: string }

export interface SpecField {
  key: string
  label: L
  type: SpecFieldType
  unit?: string
  /** Other ways the unit may be written in older values ("27 inch"). */
  unitAliases?: string[]
  options?: string[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  /** Older free-form spec names that mean this field. */
  aliases?: string[]
  /** Fields whose option may be written inside this field's old value ("16 GB DDR5"). */
  companions?: string[]
  /** Only relevant in some cases (still shown when it already has a value). */
  showIf?: (values: Record<string, string>, ctx: SpecContext) => boolean
}

export interface SpecContext {
  condition?: string
}

export type SpecGroupId =
  | 'general'
  | 'performance'
  | 'memory'
  | 'graphics'
  | 'display'
  | 'audio'
  | 'connectivity'
  | 'power'
  | 'physical'
  | 'features'
  | 'warranty'
  | 'other'

export const SPEC_GROUPS: Record<SpecGroupId, L> = {
  general: { en: 'General', fr: 'Général', ar: 'عام' },
  performance: { en: 'Performance', fr: 'Performances', ar: 'الأداء' },
  memory: { en: 'Memory & storage', fr: 'Mémoire et stockage', ar: 'الذاكرة والتخزين' },
  graphics: { en: 'Graphics', fr: 'Graphismes', ar: 'الرسومات' },
  display: { en: 'Display', fr: 'Écran', ar: 'الشاشة' },
  audio: { en: 'Audio', fr: 'Audio', ar: 'الصوت' },
  connectivity: { en: 'Connectivity & ports', fr: 'Connectivité et ports', ar: 'الاتصال والمنافذ' },
  power: { en: 'Power & battery', fr: 'Alimentation et batterie', ar: 'الطاقة والبطارية' },
  physical: { en: 'Physical details', fr: 'Caractéristiques physiques', ar: 'المواصفات الفيزيائية' },
  features: { en: 'Features', fr: 'Fonctionnalités', ar: 'الميزات' },
  warranty: { en: 'Warranty', fr: 'Garantie', ar: 'الضمان' },
  other: { en: 'Other', fr: 'Autres', ar: 'أخرى' },
}

const f = (key: string, en: string, fr: string, ar: string, rest: Omit<SpecField, 'key' | 'label'>): SpecField => ({
  key,
  label: { en, fr, ar },
  ...rest,
})

const CPU_OPTIONS = [
  'Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9',
  'Intel Core Ultra 5', 'Intel Core Ultra 7', 'Intel Core Ultra 9',
  'Intel Celeron', 'Intel Pentium', 'Intel Xeon',
  'AMD Ryzen 3', 'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'AMD Ryzen AI 9',
  'Apple M1', 'Apple M2', 'Apple M3', 'Apple M4', 'Snapdragon X Elite',
]
const GPU_OPTIONS = [
  'Integrated graphics',
  'NVIDIA GeForce RTX 3050', 'NVIDIA GeForce RTX 3060', 'NVIDIA GeForce RTX 4050', 'NVIDIA GeForce RTX 4060',
  'NVIDIA GeForce RTX 4060 Ti', 'NVIDIA GeForce RTX 4070', 'NVIDIA GeForce RTX 4070 Super', 'NVIDIA GeForce RTX 4070 Ti',
  'NVIDIA GeForce RTX 4080', 'NVIDIA GeForce RTX 4090', 'NVIDIA GeForce RTX 5060', 'NVIDIA GeForce RTX 5070',
  'NVIDIA GeForce RTX 5080', 'NVIDIA GeForce RTX 5090',
  'AMD Radeon RX 6600', 'AMD Radeon RX 7600', 'AMD Radeon RX 7700 XT', 'AMD Radeon RX 7800 XT', 'AMD Radeon RX 7900 XTX',
  'AMD Radeon RX 9070 XT', 'Intel Arc B580',
]
const PORT_OPTIONS = [
  'USB-A', 'USB-C', 'Thunderbolt 4', 'Thunderbolt 5', 'HDMI', 'DisplayPort', 'Mini DisplayPort', 'Ethernet (RJ45)',
  'SD card reader', 'microSD reader', '3.5 mm audio jack', 'VGA', 'DVI',
]
const COLOR_OPTIONS = ['Black', 'White', 'Silver', 'Gray', 'Space gray', 'Blue', 'Red', 'Green', 'Pink', 'Gold']

export const SPEC_FIELDS: Record<string, SpecField> = Object.fromEntries(
  [
    // General
    f('model', 'Model', 'Modèle', 'الطراز', { type: 'text', placeholder: 'e.g. TUF Gaming A15 FA507', aliases: ['model', 'modele', 'model number', 'reference'] }),
    f('use_case', 'Best for', 'Idéal pour', 'مناسب لـ', { type: 'text', placeholder: 'e.g. Gaming & study', aliases: ['use', 'usage', 'best for', 'ideal for', 'utilisation'] }),
    f('compatibility', 'Compatibility', 'Compatibilité', 'التوافق', { type: 'text', placeholder: 'e.g. Windows, macOS, PS5', aliases: ['compatibility', 'compatible', 'compatible with', 'fit', 'fits', 'compatibilite'] }),
    f('in_box', 'In the box', 'Contenu de la boîte', 'محتويات العلبة', { type: 'text', placeholder: 'e.g. Charger, USB-C cable', aliases: ['includes', 'included', 'in the box', 'contenu', 'box contents'] }),
    f('warranty', 'Warranty', 'Garantie', 'الضمان', { type: 'combo', options: ['No warranty', '1 month', '3 months', '6 months', '1 year', '2 years', '3 years'], aliases: ['warranty', 'garantie'] }),

    // Processor
    f('cpu', 'Processor', 'Processeur', 'المعالج', { type: 'combo', options: CPU_OPTIONS, placeholder: 'e.g. Intel Core i7-13700H', aliases: ['cpu', 'processor', 'processeur', 'processor model', 'chip'] }),
    f('cpu_generation', 'Processor generation', 'Génération du processeur', 'جيل المعالج', { type: 'combo', options: ['10th Gen', '11th Gen', '12th Gen', '13th Gen', '14th Gen', 'Core Ultra Series 1', 'Core Ultra Series 2', 'Ryzen 5000', 'Ryzen 7000', 'Ryzen 8000', 'Ryzen 9000'], aliases: ['generation', 'cpu generation', 'processor generation', 'generation du processeur'] }),
    f('cpu_socket', 'Socket', 'Socket', 'المقبس', { type: 'combo', options: ['LGA 1700', 'LGA 1851', 'LGA 1200', 'AM4', 'AM5'], aliases: ['socket', 'cpu socket'] }),
    f('cpu_cores', 'Cores', 'Cœurs', 'الأنوية', { type: 'number', min: 1, max: 256, step: 1, aliases: ['cores', 'core count', 'coeurs'] }),
    f('cpu_threads', 'Threads', 'Threads', 'مسارات المعالجة', { type: 'number', min: 1, max: 512, step: 1, aliases: ['threads'] }),
    f('base_clock', 'Base clock', 'Fréquence de base', 'التردد الأساسي', { type: 'number', unit: 'GHz', min: 0.1, max: 10, step: 0.01, aliases: ['base clock', 'base frequency'] }),
    f('boost_clock', 'Boost clock', 'Fréquence boost', 'تردد التعزيز', { type: 'number', unit: 'GHz', min: 0.1, max: 10, step: 0.01, aliases: ['boost clock', 'turbo', 'max frequency'] }),
    f('cpu_cache', 'Cache', 'Cache', 'الذاكرة المخبئية', { type: 'number', unit: 'MB', min: 0, max: 1024, step: 0.5, aliases: ['cache', 'l3 cache'] }),
    f('tdp', 'Power draw (TDP)', 'Consommation (TDP)', 'استهلاك الطاقة (TDP)', { type: 'number', unit: 'W', min: 1, max: 1500, step: 1, aliases: ['tdp', 'power consumption'] }),
    f('integrated_graphics', 'Integrated graphics', 'Graphiques intégrés', 'رسومات مدمجة', { type: 'combo', options: ['None', 'Intel UHD Graphics', 'Intel Iris Xe', 'Intel Arc', 'AMD Radeon Graphics'], aliases: ['integrated graphics', 'igpu'] }),
    f('supported_memory', 'Supported memory', 'Mémoire prise en charge', 'الذاكرة المدعومة', { type: 'text', placeholder: 'e.g. DDR5-5600, up to 192 GB', aliases: ['supported memory'] }),
    f('cooler_included', 'Cooler included', 'Ventirad inclus', 'مبرد مرفق', { type: 'bool', aliases: ['cooler included', 'cooler'] }),

    // Memory
    f('ram_gb', 'RAM', 'Mémoire vive (RAM)', 'ذاكرة الوصول العشوائي', { type: 'number', unit: 'GB', min: 1, max: 4096, step: 1, aliases: ['ram', 'memory', 'ram capacity', 'memoire', 'memoire vive'], companions: ['ram_type'] }),
    f('capacity_gb', 'Capacity', 'Capacité', 'السعة', { type: 'number', unit: 'GB', min: 1, max: 1024, step: 1, aliases: ['capacity', 'capacite', 'size'], companions: ['ram_type'] }),
    f('ram_type', 'RAM type', 'Type de RAM', 'نوع الذاكرة', { type: 'select', options: ['DDR3', 'DDR4', 'DDR5', 'LPDDR4X', 'LPDDR5', 'LPDDR5X', 'Unified memory'], aliases: ['ram type', 'memory type', 'type de ram'] }),
    f('ram_speed', 'Memory speed', 'Fréquence mémoire', 'سرعة الذاكرة', { type: 'number', unit: 'MT/s', unitAliases: ['mhz', 'mt/s'], min: 100, max: 20000, step: 1, aliases: ['speed', 'memory speed', 'frequency', 'frequence'] }),
    f('ram_form_factor', 'Form factor', 'Format', 'الشكل', { type: 'select', options: ['DIMM (desktop)', 'SO-DIMM (laptop)'], aliases: ['form factor', 'format'] }),
    f('ram_modules', 'Modules', 'Nombre de barrettes', 'عدد الوحدات', { type: 'number', min: 1, max: 16, step: 1, aliases: ['modules', 'kit'] }),
    f('cas_latency', 'CAS latency (CL)', 'Latence CAS (CL)', 'زمن CAS', { type: 'number', min: 1, max: 100, step: 1, aliases: ['cas latency', 'latency', 'cl'] }),
    f('voltage', 'Voltage', 'Tension', 'الجهد', { type: 'number', unit: 'V', min: 0.5, max: 5, step: 0.01, aliases: ['voltage', 'tension'] }),
    f('ram_max', 'Max RAM', 'RAM maximale', 'أقصى ذاكرة', { type: 'number', unit: 'GB', min: 1, max: 8192, step: 1, aliases: ['max ram', 'max memory', 'maximum memory'] }),
    f('ram_slots', 'Memory slots', 'Emplacements mémoire', 'منافذ الذاكرة', { type: 'number', min: 1, max: 16, step: 1, aliases: ['memory slots', 'ram slots', 'dimm slots'] }),

    // Storage
    f('storage', 'Storage', 'Stockage', 'التخزين', { type: 'combo', options: ['128 GB', '256 GB', '512 GB', '1 TB', '2 TB', '4 TB', '8 TB'], placeholder: 'e.g. 512 GB', aliases: ['storage', 'ssd', 'stockage', 'storage capacity', 'disk'], companions: ['storage_type'] }),
    f('storage_type', 'Storage type', 'Type de stockage', 'نوع التخزين', { type: 'select', options: ['NVMe SSD', 'SATA SSD', 'SSD', 'HDD', 'SSD + HDD', 'eMMC'], aliases: ['storage type', 'drive type', 'type de stockage'] }),
    f('interface', 'Interface', 'Interface', 'الواجهة', { type: 'select', options: ['SATA III', 'PCIe 3.0 NVMe', 'PCIe 4.0 NVMe', 'PCIe 5.0 NVMe', 'USB 3.2', 'USB-C', 'Thunderbolt'], aliases: ['interface'] }),
    f('drive_form_factor', 'Form factor', 'Format', 'الشكل', { type: 'select', options: ['2.5"', '3.5"', 'M.2 2230', 'M.2 2242', 'M.2 2280', 'External'], aliases: ['drive form factor'] }),
    f('read_speed', 'Read speed', 'Vitesse de lecture', 'سرعة القراءة', { type: 'number', unit: 'MB/s', min: 1, max: 20000, step: 1, aliases: ['read', 'read speed', 'lecture'] }),
    f('write_speed', 'Write speed', "Vitesse d'écriture", 'سرعة الكتابة', { type: 'number', unit: 'MB/s', min: 1, max: 20000, step: 1, aliases: ['write', 'write speed', 'ecriture'] }),
    f('endurance', 'Endurance', 'Endurance', 'التحمل', { type: 'number', unit: 'TBW', min: 1, max: 100000, step: 1, aliases: ['endurance', 'tbw'], showIf: (v) => !v.storage_type || /ssd/i.test(v.storage_type) }),

    // Graphics
    f('gpu', 'Graphics card', 'Carte graphique', 'بطاقة الرسومات', { type: 'combo', options: GPU_OPTIONS, aliases: ['gpu', 'graphics', 'graphics card', 'carte graphique', 'video card', 'graphique'] }),
    f('gpu_chipset', 'GPU chipset', 'Puce graphique', 'شريحة الرسومات', { type: 'combo', options: GPU_OPTIONS.slice(1), aliases: ['gpu chipset', 'chipset gpu', 'gpu'] }),
    f('vram', 'Graphics memory (VRAM)', 'Mémoire graphique (VRAM)', 'ذاكرة الرسومات', { type: 'number', unit: 'GB', min: 1, max: 256, step: 1, aliases: ['vram', 'video memory', 'graphics memory', 'memoire graphique'], companions: ['vram_type'] }),
    f('vram_type', 'VRAM type', 'Type de VRAM', 'نوع ذاكرة الرسومات', { type: 'select', options: ['GDDR5', 'GDDR6', 'GDDR6X', 'GDDR7', 'HBM2'], aliases: ['vram type', 'memory type'] }),
    f('memory_bus', 'Memory bus', 'Bus mémoire', 'ناقل الذاكرة', { type: 'number', unit: 'bit', min: 32, max: 8192, step: 1, aliases: ['memory bus', 'bus width'] }),
    f('gpu_core_clock', 'Core clock', 'Fréquence de base', 'التردد الأساسي', { type: 'number', unit: 'MHz', min: 100, max: 5000, step: 1, aliases: ['core clock', 'base clock'] }),
    f('gpu_boost_clock', 'Boost clock', 'Fréquence boost', 'تردد التعزيز', { type: 'number', unit: 'MHz', min: 100, max: 5000, step: 1, aliases: ['boost clock'] }),
    f('recommended_psu', 'Recommended power supply', 'Alimentation recommandée', 'مزود الطاقة الموصى به', { type: 'number', unit: 'W', min: 100, max: 2000, step: 50, aliases: ['recommended psu', 'psu'] }),
    f('pcie', 'PCIe interface', 'Interface PCIe', 'واجهة PCIe', { type: 'select', options: ['PCIe 3.0 x16', 'PCIe 4.0 x8', 'PCIe 4.0 x16', 'PCIe 5.0 x16'], aliases: ['pcie', 'bus', 'pcie interface'] }),
    f('display_outputs', 'Display outputs', 'Sorties vidéo', 'مخارج العرض', { type: 'multi', options: ['HDMI 2.1', 'HDMI 2.0', 'DisplayPort 1.4a', 'DisplayPort 2.1', 'USB-C', 'DVI'], aliases: ['outputs', 'display outputs', 'sorties'] }),
    f('card_length', 'Card length', 'Longueur de la carte', 'طول البطاقة', { type: 'number', unit: 'mm', min: 50, max: 500, step: 1, aliases: ['length', 'card length', 'longueur'] }),

    // Display
    f('screen_size', 'Screen size', "Taille d'écran", 'حجم الشاشة', { type: 'number', unit: '"', unitAliases: ['"', '”', '″', 'in', 'inch', 'inches', 'pouces', 'pouce'], min: 5, max: 120, step: 0.1, aliases: ['size', 'screen size', 'screen', 'taille', 'taille ecran', 'diagonal'] }),
    f('resolution', 'Resolution', 'Résolution', 'الدقة', { type: 'combo', options: ['HD (1366 × 768)', 'Full HD (1920 × 1080)', 'WUXGA (1920 × 1200)', 'QHD (2560 × 1440)', 'WQXGA (2560 × 1600)', 'UWQHD (3440 × 1440)', '4K UHD (3840 × 2160)', '5K (5120 × 2880)'], aliases: ['resolution', 'screen resolution', 'definition'] }),
    f('refresh_rate', 'Refresh rate', 'Taux de rafraîchissement', 'معدل التحديث', { type: 'number', unit: 'Hz', min: 30, max: 1000, step: 1, aliases: ['refresh', 'refresh rate', 'rafraichissement', 'frequence d affichage'] }),
    f('panel_type', 'Panel type', 'Type de dalle', 'نوع اللوحة', { type: 'select', options: ['IPS', 'VA', 'TN', 'OLED', 'QD-OLED', 'Mini-LED'], aliases: ['panel', 'panel type', 'dalle', 'type de dalle'] }),
    f('response_time', 'Response time', 'Temps de réponse', 'زمن الاستجابة', { type: 'number', unit: 'ms', min: 0.01, max: 100, step: 0.01, aliases: ['response time', 'temps de reponse'] }),
    f('aspect_ratio', 'Aspect ratio', "Format d'image", 'نسبة العرض', { type: 'select', options: ['16:9', '16:10', '21:9', '32:9', '4:3', '3:2'], aliases: ['aspect ratio', 'ratio'] }),
    f('brightness', 'Brightness', 'Luminosité', 'السطوع', { type: 'number', unit: 'nits', unitAliases: ['nits', 'cd/m2', 'cd/m²'], min: 50, max: 5000, step: 1, aliases: ['brightness', 'luminosite'] }),
    f('contrast', 'Contrast ratio', 'Contraste', 'نسبة التباين', { type: 'combo', options: ['1000:1', '3000:1', '5000:1', '1,000,000:1'], aliases: ['contrast', 'contrast ratio', 'contraste'] }),
    f('curved', 'Screen shape', "Forme de l'écran", 'شكل الشاشة', { type: 'select', options: ['Flat', 'Curved'], aliases: ['curved', 'shape'] }),
    f('hdr', 'HDR', 'HDR', 'HDR', { type: 'combo', options: ['No', 'HDR10', 'DisplayHDR 400', 'DisplayHDR 600', 'DisplayHDR 1000', 'DisplayHDR True Black 400'], aliases: ['hdr'] }),
    f('adaptive_sync', 'Adaptive Sync', 'Synchro adaptative', 'المزامنة التكيفية', { type: 'multi', options: ['FreeSync', 'FreeSync Premium', 'FreeSync Premium Pro', 'G-Sync', 'G-Sync Compatible'], aliases: ['adaptive sync', 'freesync', 'g-sync', 'sync'] }),
    f('vesa', 'VESA mount', 'Fixation VESA', 'تثبيت VESA', { type: 'select', options: ['No', '75 × 75', '100 × 100', '200 × 200'], aliases: ['vesa'] }),
    f('speakers', 'Built-in speakers', 'Haut-parleurs intégrés', 'مكبرات صوت مدمجة', { type: 'bool', aliases: ['speakers', 'haut-parleurs'] }),
    f('touchscreen', 'Touchscreen', 'Écran tactile', 'شاشة لمس', { type: 'bool', aliases: ['touch', 'touchscreen', 'tactile'] }),

    // Laptop / PC
    f('os', 'Operating system', "Système d'exploitation", 'نظام التشغيل', { type: 'combo', options: ['Windows 11 Home', 'Windows 11 Pro', 'Windows 10 Pro', 'macOS', 'ChromeOS', 'Linux', 'FreeDOS', 'No OS'], aliases: ['os', 'operating system', 'systeme', 'systeme d exploitation', 'windows'] }),
    f('keyboard_layout', 'Keyboard layout', 'Disposition du clavier', 'تخطيط لوحة المفاتيح', { type: 'select', options: ['AZERTY (French)', 'QWERTY (US)', 'QWERTY (UK)', 'QWERTZ', 'Arabic / AZERTY', 'Arabic / QWERTY'], aliases: ['keyboard', 'layout', 'keyboard layout', 'clavier'] }),
    f('keyboard_backlight', 'Backlit keyboard', 'Clavier rétroéclairé', 'لوحة مفاتيح مضيئة', { type: 'select', options: ['No', 'White', 'RGB', 'Per-key RGB'], aliases: ['backlight', 'backlit keyboard', 'retroeclairage'] }),
    f('webcam', 'Webcam', 'Webcam', 'كاميرا الويب', { type: 'combo', options: ['No', '720p', '1080p', '1080p + IR (Windows Hello)', '1440p'], aliases: ['webcam', 'camera'] }),
    f('battery', 'Battery', 'Batterie', 'البطارية', { type: 'number', unit: 'Wh', min: 1, max: 200, step: 0.1, aliases: ['battery', 'batterie', 'battery capacity'] }),
    f('battery_life', 'Battery life', 'Autonomie', 'عمر البطارية', { type: 'number', unit: 'h', unitAliases: ['h', 'hours', 'hrs', 'heures'], min: 0.5, max: 500, step: 0.5, aliases: ['battery life', 'autonomie'] }),
    f('battery_health', 'Battery health', 'Santé de la batterie', 'صحة البطارية', { type: 'number', unit: '%', min: 0, max: 100, step: 1, aliases: ['battery health', 'sante batterie'], showIf: (_v, ctx) => ctx.condition !== 'new' }),
    f('wifi', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi', { type: 'select', options: ['No', 'Wi-Fi 5', 'Wi-Fi 6', 'Wi-Fi 6E', 'Wi-Fi 7'], aliases: ['wifi', 'wi-fi', 'wireless'] }),
    f('bluetooth', 'Bluetooth', 'Bluetooth', 'بلوتوث', { type: 'select', options: ['No', '4.2', '5.0', '5.1', '5.2', '5.3', '5.4'], aliases: ['bluetooth'] }),
    f('ethernet', 'Ethernet', 'Ethernet', 'إيثرنت', { type: 'select', options: ['No', '100 Mb', '1 GbE', '2.5 GbE', '5 GbE', '10 GbE'], aliases: ['ethernet', 'lan', 'rj45'] }),
    f('ports', 'Ports', 'Ports', 'المنافذ', { type: 'multi', options: PORT_OPTIONS, aliases: ['ports', 'connectique', 'i/o'] }),
    f('motherboard', 'Motherboard', 'Carte mère', 'اللوحة الأم', { type: 'text', placeholder: 'e.g. MSI B760 Gaming Plus', aliases: ['motherboard', 'carte mere', 'mainboard'] }),
    f('psu_watts', 'Power supply', 'Alimentation', 'مزود الطاقة', { type: 'number', unit: 'W', min: 100, max: 3000, step: 1, aliases: ['psu', 'power supply', 'alimentation'], companions: ['psu_rating'] }),
    f('psu_rating', '80 PLUS rating', 'Certification 80 PLUS', 'تصنيف 80 PLUS', { type: 'select', options: ['White', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Titanium'], aliases: ['80 plus', 'psu rating', 'efficiency'] }),
    f('pc_case', 'Case', 'Boîtier', 'الصندوق', { type: 'text', placeholder: 'e.g. NZXT H5 Flow', aliases: ['case', 'boitier', 'chassis'] }),
    f('cooling', 'Cooling', 'Refroidissement', 'التبريد', { type: 'combo', options: ['Stock cooler', 'Air cooler', 'AIO liquid 240 mm', 'AIO liquid 280 mm', 'AIO liquid 360 mm'], aliases: ['cooling', 'cooler', 'refroidissement'] }),

    // Motherboard
    f('chipset', 'Chipset', 'Chipset', 'الشريحة', { type: 'combo', options: ['Intel H610', 'Intel B760', 'Intel Z790', 'Intel B860', 'Intel Z890', 'AMD A620', 'AMD B550', 'AMD B650', 'AMD X670E', 'AMD B850', 'AMD X870E'], aliases: ['chipset'] }),
    f('mb_form_factor', 'Form factor', 'Format', 'الشكل', { type: 'select', options: ['ATX', 'Micro-ATX', 'Mini-ITX', 'E-ATX'], aliases: ['form factor', 'format'] }),
    f('m2_slots', 'M.2 slots', 'Emplacements M.2', 'منافذ M.2', { type: 'number', min: 0, max: 10, step: 1, aliases: ['m.2 slots', 'm2 slots', 'm.2'] }),
    f('sata_ports', 'SATA ports', 'Ports SATA', 'منافذ SATA', { type: 'number', min: 0, max: 16, step: 1, aliases: ['sata', 'sata ports'] }),
    f('pcie_slots', 'PCIe slots', 'Emplacements PCIe', 'منافذ PCIe', { type: 'text', placeholder: 'e.g. 1 × PCIe 5.0 x16, 2 × PCIe 4.0 x1', aliases: ['pcie slots', 'expansion slots'] }),
    f('internal_headers', 'Internal connectors', 'Connecteurs internes', 'الموصلات الداخلية', { type: 'text', placeholder: 'e.g. USB-C front header, 4 × fan, ARGB', aliases: ['internal connectors', 'headers'] }),

    // Peripherals
    f('connection', 'Connection', 'Connexion', 'الاتصال', { type: 'multi', options: ['USB wired', 'USB-C wired', '2.4 GHz wireless', 'Bluetooth', '3.5 mm jack'], aliases: ['connection', 'connexion', 'connection type', 'wired', 'wireless'] }),
    f('keyboard_type', 'Keyboard type', 'Type de clavier', 'نوع لوحة المفاتيح', { type: 'select', options: ['Full size (100%)', 'TKL (80%)', '75%', '65%', '60%', 'Numpad', 'Keyboard + mouse combo'], aliases: ['keyboard type', 'size'] }),
    f('key_mechanism', 'Mechanism', 'Technologie', 'آلية المفاتيح', { type: 'select', options: ['Mechanical', 'Membrane', 'Optical', 'Hall effect (magnetic)', 'Scissor'], aliases: ['mechanism', 'mechanical', 'membrane', 'type'] }),
    f('switch_type', 'Switches', 'Switches', 'نوع المفاتيح', { type: 'combo', options: ['Red (linear)', 'Brown (tactile)', 'Blue (clicky)', 'Yellow (linear)', 'Silver (speed)', 'Optical'], aliases: ['switch', 'switches', 'switch type'] }),
    f('key_count', 'Number of keys', 'Nombre de touches', 'عدد المفاتيح', { type: 'number', min: 10, max: 200, step: 1, aliases: ['keys', 'number of keys', 'touches'] }),
    f('lighting', 'Lighting', 'Éclairage', 'الإضاءة', { type: 'select', options: ['None', 'White', 'Single color', 'RGB', 'Per-key RGB'], aliases: ['lighting', 'rgb', 'backlight', 'eclairage'] }),
    f('sensor', 'Sensor', 'Capteur', 'المستشعر', { type: 'combo', options: ['Optical', 'Laser', 'PixArt PAW3395', 'Logitech HERO 25K', 'Razer Focus Pro 30K'], aliases: ['sensor', 'capteur'] }),
    f('dpi', 'Max DPI', 'DPI max', 'أقصى DPI', { type: 'number', unit: 'DPI', min: 100, max: 50000, step: 50, aliases: ['dpi', 'max dpi', 'cpi'] }),
    f('polling_rate', 'Polling rate', 'Taux de rapport', 'معدل الاستجابة', { type: 'number', unit: 'Hz', min: 50, max: 8000, step: 1, aliases: ['polling rate', 'polling'] }),
    f('buttons', 'Buttons', 'Boutons', 'الأزرار', { type: 'number', min: 1, max: 30, step: 1, aliases: ['buttons', 'boutons'] }),
    f('weight_g', 'Weight', 'Poids', 'الوزن', { type: 'number', unit: 'g', min: 1, max: 5000, step: 1, aliases: ['weight', 'poids'] }),

    // Audio
    f('audio_type', 'Type', 'Type', 'النوع', { type: 'select', options: ['Over-ear headphones', 'On-ear headphones', 'In-ear / earbuds', 'Gaming headset', 'Speakers', 'Soundbar', 'Microphone'], aliases: ['type', 'audio type'] }),
    f('frequency_response', 'Frequency response', 'Réponse en fréquence', 'استجابة التردد', { type: 'text', placeholder: 'e.g. 20 Hz – 20 kHz', aliases: ['frequency response', 'reponse en frequence'] }),
    f('impedance', 'Impedance', 'Impédance', 'المقاومة', { type: 'number', unit: 'Ω', unitAliases: ['ω', 'ohm', 'ohms'], min: 1, max: 1000, step: 1, aliases: ['impedance'] }),
    f('audio_power', 'Output power', 'Puissance', 'القدرة', { type: 'number', unit: 'W', min: 1, max: 5000, step: 1, aliases: ['power', 'output power', 'puissance'] }),
    f('microphone', 'Microphone', 'Microphone', 'ميكروفون', { type: 'select', options: ['No', 'Built-in', 'Detachable', 'Retractable'], aliases: ['microphone', 'mic', 'micro'] }),
    f('anc', 'Noise cancellation', 'Réduction de bruit', 'إلغاء الضوضاء', { type: 'select', options: ['No', 'Active (ANC)', 'Passive'], aliases: ['anc', 'noise cancellation', 'reduction de bruit'] }),
    f('surround', 'Surround sound', 'Son surround', 'صوت محيطي', { type: 'combo', options: ['No', 'Stereo', 'Virtual 7.1', 'Dolby Atmos', 'DTS:X'], aliases: ['surround', 'surround sound'] }),

    // Printers
    f('printer_type', 'Device type', "Type d'appareil", 'نوع الجهاز', { type: 'select', options: ['Printer', 'All-in-one (print, scan, copy)', 'Scanner', 'Photo printer', 'Label printer'], aliases: ['type', 'device type'] }),
    f('print_tech', 'Printing technology', "Technologie d'impression", 'تقنية الطباعة', { type: 'select', options: ['Inkjet', 'Ink tank', 'Laser', 'LED', 'Thermal', 'Dot matrix'], aliases: ['technology', 'printing technology'] }),
    f('print_color', 'Print colour', 'Impression', 'الطباعة', { type: 'select', options: ['Color', 'Monochrome'], aliases: ['color printing', 'print color'] }),
    f('print_resolution', 'Print resolution', "Résolution d'impression", 'دقة الطباعة', { type: 'text', placeholder: 'e.g. 4800 × 1200 dpi', aliases: ['print resolution'] }),
    f('print_speed', 'Print speed', "Vitesse d'impression", 'سرعة الطباعة', { type: 'number', unit: 'ppm', min: 1, max: 200, step: 1, aliases: ['print speed', 'speed'] }),
    f('paper_sizes', 'Paper sizes', 'Formats papier', 'أحجام الورق', { type: 'multi', options: ['A4', 'A3', 'A5', 'A6', 'Letter', 'Legal', 'Envelopes', 'Photo 10×15'], aliases: ['paper', 'paper sizes'] }),
    f('duplex', 'Duplex printing', 'Recto verso', 'طباعة على الوجهين', { type: 'select', options: ['No', 'Manual', 'Automatic'], aliases: ['duplex', 'recto verso'] }),
    f('scan_resolution', 'Scanner resolution', 'Résolution du scanner', 'دقة الماسح', { type: 'number', unit: 'dpi', min: 50, max: 20000, step: 1, aliases: ['scan resolution'], showIf: (v) => !['Printer', 'Photo printer', 'Label printer'].includes(v.printer_type) }),
    f('printer_connectivity', 'Connectivity', 'Connectivité', 'الاتصال', { type: 'multi', options: ['USB', 'Wi-Fi', 'Wi-Fi Direct', 'Ethernet', 'Bluetooth', 'Mobile app printing'], aliases: ['connectivity', 'connectivite'] }),
    f('cartridges', 'Cartridges / toner', 'Cartouches / toner', 'الخراطيش / الحبر', { type: 'text', placeholder: 'e.g. HP 305 black & color', aliases: ['cartridge', 'cartridges', 'toner', 'ink'] }),

    // Networking
    f('network_type', 'Device type', "Type d'appareil", 'نوع الجهاز', { type: 'select', options: ['Router', 'Mesh Wi-Fi system', 'Access point', 'Range extender', 'Switch', 'Network adapter (USB)', 'Network adapter (PCIe)', '4G/5G router', 'Modem'], aliases: ['type', 'device type'] }),
    f('wifi_standard', 'Wi-Fi standard', 'Norme Wi-Fi', 'معيار Wi-Fi', { type: 'select', options: ['Wi-Fi 4 (802.11n)', 'Wi-Fi 5 (802.11ac)', 'Wi-Fi 6 (802.11ax)', 'Wi-Fi 6E', 'Wi-Fi 7 (802.11be)', 'None (wired only)'], aliases: ['wifi', 'wi-fi', 'wifi standard', 'standard'] }),
    f('max_speed', 'Max speed', 'Débit max', 'أقصى سرعة', { type: 'text', placeholder: 'e.g. AX3000 (3000 Mbps)', aliases: ['speed', 'max speed', 'debit'] }),
    f('lan_ports', 'Ethernet ports', 'Ports Ethernet', 'منافذ إيثرنت', { type: 'number', min: 0, max: 64, step: 1, aliases: ['lan ports', 'ethernet ports', 'ports'] }),
    f('bands', 'Frequency bands', 'Bandes de fréquence', 'نطاقات التردد', { type: 'multi', options: ['2.4 GHz', '5 GHz', '6 GHz'], aliases: ['bands', 'frequency bands'] }),
    f('antennas', 'Antennas', 'Antennes', 'الهوائيات', { type: 'number', min: 0, max: 16, step: 1, aliases: ['antennas', 'antennes'] }),
    f('poe', 'PoE', 'PoE', 'PoE', { type: 'select', options: ['No', 'PoE', 'PoE+', 'PoE++'], aliases: ['poe'] }),
    f('network_security', 'Security', 'Sécurité', 'الأمان', { type: 'multi', options: ['WPA2', 'WPA3', 'Firewall', 'VPN', 'Parental controls', 'Guest network'], aliases: ['security', 'securite'] }),

    // Physical
    f('color', 'Color', 'Couleur', 'اللون', { type: 'combo', options: COLOR_OPTIONS, aliases: ['color', 'colour', 'couleur'] }),
    f('material', 'Material', 'Matériau', 'المادة', { type: 'combo', options: ['Aluminum', 'Plastic', 'Steel', 'Glass', 'Fabric', 'Leather', 'Wood'], aliases: ['material', 'materiau', 'matiere'] }),
    f('dimensions', 'Dimensions', 'Dimensions', 'الأبعاد', { type: 'text', placeholder: 'e.g. 35.7 × 25.1 × 2.3 cm', aliases: ['dimensions', 'size (cm)'] }),
    f('weight', 'Weight', 'Poids', 'الوزن', { type: 'number', unit: 'kg', min: 0.01, max: 200, step: 0.01, aliases: ['weight', 'poids'] }),
  ].map((field) => [field.key, field])
)

export interface SpecTemplate {
  id: string
  label: L
  groups: { id: SpecGroupId; fields: string[] }[]
  /** Fields worth filling first, highlighted in the form and listed first in the shop. */
  important: string[]
}

const t = (id: string, en: string, fr: string, ar: string, groups: SpecTemplate['groups'], important: string[]): SpecTemplate => ({
  id,
  label: { en, fr, ar },
  groups: [...groups, { id: 'warranty', fields: ['warranty'] }],
  important,
})

export const SPEC_TEMPLATES: SpecTemplate[] = [
  t('laptop', 'Laptop', 'Ordinateur portable', 'حاسوب محمول', [
    { id: 'general', fields: ['model', 'use_case'] },
    { id: 'performance', fields: ['cpu', 'cpu_generation', 'os'] },
    { id: 'memory', fields: ['ram_gb', 'ram_type', 'storage', 'storage_type'] },
    { id: 'graphics', fields: ['gpu', 'vram'] },
    { id: 'display', fields: ['screen_size', 'resolution', 'refresh_rate', 'panel_type', 'touchscreen'] },
    { id: 'connectivity', fields: ['wifi', 'bluetooth', 'ports', 'webcam'] },
    { id: 'power', fields: ['battery', 'battery_life', 'battery_health'] },
    { id: 'physical', fields: ['keyboard_layout', 'keyboard_backlight', 'color', 'weight', 'dimensions', 'in_box'] },
  ], ['cpu', 'ram_gb', 'storage', 'gpu', 'screen_size', 'resolution', 'refresh_rate', 'os']),
  t('desktop', 'Desktop PC', 'PC de bureau', 'حاسوب مكتبي', [
    { id: 'general', fields: ['model', 'use_case'] },
    { id: 'performance', fields: ['cpu', 'cpu_generation', 'motherboard', 'cooling', 'os'] },
    { id: 'memory', fields: ['ram_gb', 'ram_type', 'storage', 'storage_type'] },
    { id: 'graphics', fields: ['gpu', 'vram'] },
    { id: 'power', fields: ['psu_watts', 'psu_rating'] },
    { id: 'connectivity', fields: ['wifi', 'bluetooth', 'ethernet', 'ports'] },
    { id: 'physical', fields: ['pc_case', 'color', 'dimensions', 'weight', 'in_box'] },
  ], ['cpu', 'ram_gb', 'storage', 'gpu', 'psu_watts', 'os']),
  t('monitor', 'Monitor', 'Écran', 'شاشة', [
    { id: 'general', fields: ['model', 'use_case'] },
    { id: 'display', fields: ['screen_size', 'resolution', 'panel_type', 'refresh_rate', 'response_time', 'aspect_ratio', 'brightness', 'contrast', 'curved', 'hdr', 'adaptive_sync'] },
    { id: 'connectivity', fields: ['ports'] },
    { id: 'features', fields: ['vesa', 'speakers'] },
    { id: 'physical', fields: ['color', 'weight', 'dimensions', 'in_box'] },
  ], ['screen_size', 'resolution', 'panel_type', 'refresh_rate', 'response_time']),
  t('gpu', 'Graphics card', 'Carte graphique', 'بطاقة رسومات', [
    { id: 'general', fields: ['model'] },
    { id: 'graphics', fields: ['gpu_chipset', 'vram', 'vram_type', 'memory_bus', 'gpu_core_clock', 'gpu_boost_clock'] },
    { id: 'power', fields: ['tdp', 'recommended_psu'] },
    { id: 'connectivity', fields: ['pcie', 'display_outputs'] },
    { id: 'physical', fields: ['card_length'] },
  ], ['gpu_chipset', 'vram', 'vram_type', 'gpu_boost_clock', 'recommended_psu']),
  t('cpu', 'Processor', 'Processeur', 'معالج', [
    { id: 'general', fields: ['model'] },
    { id: 'performance', fields: ['cpu_generation', 'cpu_socket', 'cpu_cores', 'cpu_threads', 'base_clock', 'boost_clock', 'cpu_cache'] },
    { id: 'power', fields: ['tdp'] },
    { id: 'features', fields: ['integrated_graphics', 'supported_memory', 'cooler_included'] },
  ], ['cpu_socket', 'cpu_cores', 'cpu_threads', 'boost_clock']),
  t('ram', 'RAM / memory', 'RAM / mémoire', 'ذاكرة RAM', [
    { id: 'general', fields: ['model'] },
    { id: 'memory', fields: ['capacity_gb', 'ram_type', 'ram_speed', 'ram_form_factor', 'ram_modules', 'cas_latency', 'voltage'] },
    { id: 'features', fields: ['lighting'] },
  ], ['capacity_gb', 'ram_type', 'ram_speed', 'ram_form_factor']),
  t('storage', 'Storage (SSD / HDD)', 'Stockage (SSD / HDD)', 'تخزين (SSD / HDD)', [
    { id: 'general', fields: ['model'] },
    { id: 'memory', fields: ['storage', 'storage_type', 'interface', 'drive_form_factor', 'read_speed', 'write_speed', 'endurance'] },
  ], ['storage', 'storage_type', 'interface', 'read_speed']),
  t('motherboard', 'Motherboard', 'Carte mère', 'لوحة أم', [
    { id: 'general', fields: ['model'] },
    { id: 'performance', fields: ['cpu_socket', 'chipset', 'mb_form_factor'] },
    { id: 'memory', fields: ['ram_type', 'ram_max', 'ram_slots', 'm2_slots', 'sata_ports'] },
    { id: 'connectivity', fields: ['pcie_slots', 'wifi', 'bluetooth', 'ethernet', 'ports', 'internal_headers'] },
  ], ['cpu_socket', 'chipset', 'mb_form_factor', 'ram_type']),
  t('keyboard', 'Keyboard', 'Clavier', 'لوحة مفاتيح', [
    { id: 'general', fields: ['model', 'keyboard_type', 'key_mechanism', 'switch_type', 'keyboard_layout', 'key_count'] },
    { id: 'connectivity', fields: ['connection', 'compatibility', 'battery_life'] },
    { id: 'features', fields: ['lighting'] },
    { id: 'physical', fields: ['color', 'weight_g', 'in_box'] },
  ], ['keyboard_type', 'key_mechanism', 'keyboard_layout', 'connection']),
  t('mouse', 'Mouse', 'Souris', 'فأرة', [
    { id: 'general', fields: ['model', 'sensor', 'dpi', 'polling_rate', 'buttons'] },
    { id: 'connectivity', fields: ['connection', 'compatibility', 'battery_life'] },
    { id: 'features', fields: ['lighting'] },
    { id: 'physical', fields: ['color', 'weight_g', 'in_box'] },
  ], ['dpi', 'sensor', 'connection']),
  t('audio', 'Headphones / speakers', 'Casques / enceintes', 'سماعات / مكبرات صوت', [
    { id: 'general', fields: ['model', 'audio_type'] },
    { id: 'audio', fields: ['frequency_response', 'impedance', 'audio_power', 'microphone', 'anc', 'surround'] },
    { id: 'connectivity', fields: ['connection', 'compatibility', 'battery_life'] },
    { id: 'physical', fields: ['color', 'weight_g', 'in_box'] },
  ], ['audio_type', 'connection', 'microphone']),
  t('printer', 'Printer / scanner', 'Imprimante / scanner', 'طابعة / ماسح', [
    { id: 'general', fields: ['model', 'printer_type', 'print_tech', 'print_color'] },
    { id: 'performance', fields: ['print_resolution', 'print_speed', 'paper_sizes', 'duplex', 'scan_resolution'] },
    { id: 'connectivity', fields: ['printer_connectivity'] },
    { id: 'features', fields: ['cartridges'] },
  ], ['printer_type', 'print_tech', 'print_color', 'printer_connectivity']),
  t('networking', 'Networking', 'Réseau', 'الشبكات', [
    { id: 'general', fields: ['model', 'network_type'] },
    { id: 'performance', fields: ['wifi_standard', 'max_speed', 'bands', 'ethernet', 'lan_ports', 'antennas', 'poe'] },
    { id: 'features', fields: ['network_security', 'compatibility'] },
  ], ['network_type', 'wifi_standard', 'max_speed']),
  t('accessory', 'Accessory / other', 'Accessoire / autre', 'إكسسوار / أخرى', [
    { id: 'general', fields: ['model', 'use_case', 'compatibility', 'connection'] },
    { id: 'physical', fields: ['dimensions', 'weight', 'color', 'material', 'in_box'] },
  ], ['compatibility']),
]

export const DEFAULT_TEMPLATE = 'accessory'
const TEMPLATE_BY_ID = new Map(SPEC_TEMPLATES.map((tpl) => [tpl.id, tpl]))

export function getTemplate(id?: string | null): SpecTemplate {
  return TEMPLATE_BY_ID.get(id || '') ?? TEMPLATE_BY_ID.get(DEFAULT_TEMPLATE)!
}

export function isTemplateId(id?: string | null): boolean {
  return Boolean(id && TEMPLATE_BY_ID.has(id))
}

export function templateFields(tpl: SpecTemplate): string[] {
  return tpl.groups.flatMap((g) => g.fields)
}

/** Lowercase, accents and punctuation removed, for matching names. */
function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9.+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Most specific first: "carte graphique" before "carte mère", "gaming pc" before "pc". */
const DETECT: [string, string[]][] = [
  ['gpu', ['graphics card', 'carte graphique', 'cartes graphiques', 'gpu', 'video card']],
  ['motherboard', ['motherboard', 'carte mere', 'cartes meres', 'mainboard']],
  ['laptop', ['laptop', 'notebook', 'ultrabook', 'chromebook', 'macbook', 'ordinateur portable', 'portable']],
  ['monitor', ['monitor', 'moniteur', 'ecran', 'display', 'screen']],
  ['cpu', ['processor', 'processeur', 'cpu']],
  ['ram', ['ram', 'memory', 'memoire']],
  ['storage', ['ssd', 'hdd', 'hard drive', 'storage', 'stockage', 'disque']],
  ['keyboard', ['keyboard', 'clavier']],
  ['mouse', ['mouse', 'mice', 'souris']],
  ['audio', ['headphone', 'headset', 'casque', 'speaker', 'enceinte', 'audio', 'earbud', 'ecouteur']],
  ['printer', ['printer', 'imprimante', 'scanner']],
  ['networking', ['router', 'routeur', 'network', 'reseau', 'switch', 'modem', 'wifi', 'networking']],
  ['desktop', ['gaming pc', 'desktop', 'pc gamer', 'tower', 'ordinateur de bureau', 'all in one', 'pc', 'pcs', 'computer']],
]

/** Guess the template from a category's name/slug. */
export function detectTemplate(text: string): string | null {
  const s = ` ${norm(text)} `
  for (const [id, words] of DETECT) {
    if (words.some((w) => s.includes(` ${w} `) || s.includes(` ${w}s `))) return id
  }
  return null
}

type CategoryLike = { _id?: string; name?: string; slug?: string; specTemplate?: string | null; parent?: unknown }

/** Template for a category: its own setting, else its parent's, else guessed from its name. */
export function templateForCategory(category: CategoryLike | null | undefined, all: CategoryLike[] = []): string {
  let c: CategoryLike | null | undefined = category
  for (let depth = 0; c && depth < 5; depth++) {
    if (isTemplateId(c.specTemplate)) return c.specTemplate!
    const guess = detectTemplate(`${c.slug || ''} ${c.name || ''}`)
    if (guess) return guess
    const parentId = typeof c.parent === 'string' ? c.parent : (c.parent as CategoryLike | null)?._id
    c = parentId ? all.find((x) => x._id === parentId) : null
  }
  return DEFAULT_TEMPLATE
}

export function resolveTemplate(productTemplate: string | null | undefined, category: CategoryLike | null | undefined, all: CategoryLike[] = []) {
  return isTemplateId(productTemplate) ? productTemplate! : templateForCategory(category, all)
}

// ---------------------------------------------------------------------------
// Editing: split stored specs into template values + custom rows, and back
// ---------------------------------------------------------------------------

export interface CustomSpec {
  id: string
  label: string
  value: string
}

export interface SpecDraft {
  template: string
  values: Record<string, string>
  custom: CustomSpec[]
}

let customSeq = 0
export const newCustomSpec = (label = '', value = ''): CustomSpec => ({ id: `c${++customSeq}`, label, value })

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseNumber(field: SpecField, raw: string): string | null {
  const units = [field.unit, ...(field.unitAliases ?? [])].filter(Boolean).map((u) => escapeRe(u!.toLowerCase()))
  const re = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(?:${units.length ? units.join('|') : '(?!)'})?\\s*$`, 'i')
  const m = raw.trim().toLowerCase().match(re)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return Number.isFinite(n) ? String(n) : null
}

function matchOption(field: SpecField, raw: string): string | null {
  const v = norm(raw)
  return field.options?.find((o) => norm(o) === v) ?? null
}

/**
 * A value as it would be stored for this field, or null when it does not fit
 * (then it is kept as a custom spec instead, never dropped).
 */
function coerce(field: SpecField, raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  switch (field.type) {
    case 'number':
      return parseNumber(field, v)
    case 'select':
      return matchOption(field, v)
    case 'bool': {
      const n = norm(v)
      if (['yes', 'oui', 'true', '1', 'نعم'].includes(n)) return 'Yes'
      if (['no', 'non', 'false', '0', 'لا'].includes(n)) return 'No'
      return null
    }
    default:
      return v
  }
}

function aliasesOf(field: SpecField) {
  return new Set([field.key, field.label.en, field.label.fr, ...(field.aliases ?? [])].map(norm))
}

/** Pull a companion option out of an old combined value: "16 GB DDR5" → DDR5 + "16 GB". */
function takeCompanions(field: SpecField, raw: string, values: Record<string, string>) {
  let rest = raw
  for (const key of field.companions ?? []) {
    const comp = SPEC_FIELDS[key]
    if (!comp?.options || values[key]) continue
    const opts = [...comp.options].sort((a, b) => b.length - a.length)
    for (const o of opts) {
      const re = new RegExp(`(^|[\\s,/(])${escapeRe(o)}(?=$|[\\s,/)])`, 'i')
      if (re.test(rest)) {
        values[key] = o
        rest = rest.replace(re, '$1').replace(/\s+/g, ' ').trim()
        break
      }
    }
  }
  return rest
}

/**
 * Place stored entries into a template: matching fields get their value, everything else stays
 * as a custom spec. Nothing is ever discarded.
 */
export function distribute(entries: [string, string][], templateId: string): SpecDraft {
  const tpl = getTemplate(templateId)
  const keys = templateFields(tpl)
  const inTemplate = new Set(keys)
  const values: Record<string, string> = {}
  const custom: CustomSpec[] = []
  const leftovers: [string, string][] = []

  // 1. Exact field keys first (data saved by this form)
  for (const [k, v] of entries) {
    const value = String(v ?? '').trim()
    if (!value) continue
    if (inTemplate.has(k) && !values[k]) {
      const c = coerce(SPEC_FIELDS[k], value)
      if (c !== null) {
        values[k] = c
        continue
      }
    }
    leftovers.push([k, value])
  }

  // 2. Older names ("RAM", "CPU", "Refresh"...) mapped onto empty template fields
  for (const [k, value] of leftovers) {
    const n = norm(k)
    let placed = false
    for (const key of keys) {
      const field = SPEC_FIELDS[key]
      if (values[key] || !aliasesOf(field).has(n)) continue
      const trial = { ...values }
      const rest = takeCompanions(field, value, trial)
      const c = coerce(field, rest)
      if (c !== null) {
        Object.assign(values, trial)
        values[key] = c
        placed = true
        break
      }
    }
    if (placed) continue
    // A field from another template keeps its readable label and unit
    const known = SPEC_FIELDS[k]
    custom.push(newCustomSpec(known ? known.label.en : k, known ? formatSpecValue(k, value, 'en') : value))
  }

  return { template: tpl.id, values, custom }
}

/** Current draft back to stored entries (template fields by key, custom specs by label). */
export function draftEntries(draft: SpecDraft): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(draft.values)) if (v.trim()) out.push([k, v.trim()])
  for (const c of draft.custom) if (c.label.trim() && c.value.trim()) out.push([c.label.trim(), c.value.trim()])
  return out
}

export function draftToSpecs(draft: SpecDraft): Record<string, string> {
  return Object.fromEntries(draftEntries(draft))
}

/** Custom specs named like a field of the template (allowed, but better moved into the field). */
export function customFieldClash(draft: SpecDraft, label: string): string | null {
  const n = norm(label)
  if (!n) return null
  const key = templateFields(getTemplate(draft.template)).find((k) => aliasesOf(SPEC_FIELDS[k]).has(n))
  return key ? SPEC_FIELDS[key].label.en : null
}

export function isFieldVisible(key: string, values: Record<string, string>, ctx: SpecContext) {
  const field = SPEC_FIELDS[key]
  return !field?.showIf || Boolean(values[key]) || field.showIf(values, ctx)
}

/** Problems that block saving, keyed by field key or custom row id. */
export function validateDraft(draft: SpecDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [k, raw] of Object.entries(draft.values)) {
    const field = SPEC_FIELDS[k]
    const v = raw.trim()
    if (!field || !v || field.type !== 'number') continue
    const n = Number(v)
    if (!Number.isFinite(n)) errors[k] = 'Enter a number'
    else if (field.min !== undefined && n < field.min) errors[k] = `Minimum ${field.min}`
    else if (field.max !== undefined && n > field.max) errors[k] = `Maximum ${field.max}`
    else if (field.step !== undefined && Number.isInteger(field.step) && !Number.isInteger(n)) errors[k] = 'Whole number only'
  }
  const seen = new Set<string>()
  for (const c of draft.custom) {
    const label = c.label.trim()
    if (!label && !c.value.trim()) continue
    if (!label) errors[c.id] = 'Add a name'
    else if (!c.value.trim()) errors[c.id] = 'Add a value'
    else if (label.length > 60) errors[c.id] = 'Name too long (60 max)'
    else if (/^\$/.test(label)) errors[c.id] = 'Name cannot start with $'
    else if (SPEC_FIELDS[label]) errors[c.id] = 'This name is reserved'
    else if (seen.has(norm(label))) errors[c.id] = 'Duplicate name'
    seen.add(norm(label))
  }
  return errors
}

// ---------------------------------------------------------------------------
// Display (shop, compare)
// ---------------------------------------------------------------------------

const YES_NO: Record<string, L> = {
  Yes: { en: 'Yes', fr: 'Oui', ar: 'نعم' },
  No: { en: 'No', fr: 'Non', ar: 'لا' },
}

export function specLabel(key: string, locale: Locale) {
  return SPEC_FIELDS[key]?.label[locale] ?? key
}

/** Stored value with its unit / translation, e.g. "16" → "16 GB". */
export function formatSpecValue(key: string, value: string, locale: Locale) {
  const field = SPEC_FIELDS[key]
  if (!field) return value
  if (field.type === 'bool' || YES_NO[value]) return YES_NO[value]?.[locale] ?? value
  if (field.type === 'number' && field.unit && /^-?\d+(\.\d+)?$/.test(value)) {
    const shown = locale === 'fr' ? value.replace('.', ',') : value
    return field.unit === '"' || field.unit === '%' ? `${shown}${field.unit}` : `${shown} ${field.unit}`
  }
  return value
}

export interface SpecRow {
  key: string
  label: string
  value: string
  important: boolean
}

export interface SpecSection {
  id: SpecGroupId
  title: string
  rows: SpecRow[]
}

const GROUP_ORDER = Object.keys(SPEC_GROUPS) as SpecGroupId[]

/** Saved specs grouped for display; only specs with a value, template order first. */
export function groupSpecs(specs: Record<string, string> | null | undefined, templateId: string, locale: Locale): SpecSection[] {
  const entries = Object.entries(specs || {}).filter(([, v]) => String(v ?? '').trim())
  if (!entries.length) return []
  const tpl = getTemplate(templateId)
  const groupOf = new Map<string, SpecGroupId>()
  const order = new Map<string, number>()
  tpl.groups.forEach((g) => g.fields.forEach((k) => {
    groupOf.set(k, g.id)
    order.set(k, order.size)
  }))
  // Fields from another template still go to a sensible section
  for (const other of SPEC_TEMPLATES) {
    other.groups.forEach((g) => g.fields.forEach((k) => {
      if (!groupOf.has(k)) groupOf.set(k, g.id)
    }))
  }

  const sections = new Map<SpecGroupId, SpecRow[]>()
  const sorted = entries
    .map(([k, v], i) => ({ k, v: String(v), i }))
    .sort((a, b) => (order.get(a.k) ?? 1000 + a.i) - (order.get(b.k) ?? 1000 + b.i))
  for (const { k, v } of sorted) {
    const g = groupOf.get(k) ?? 'other'
    const rows = sections.get(g) ?? []
    rows.push({ key: k, label: specLabel(k, locale), value: formatSpecValue(k, v, locale), important: tpl.important.includes(k) })
    sections.set(g, rows)
  }
  return GROUP_ORDER.filter((g) => sections.has(g)).map((g) => ({ id: g, title: SPEC_GROUPS[g][locale], rows: sections.get(g)! }))
}
