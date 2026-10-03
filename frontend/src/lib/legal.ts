import type { Locale } from '@/i18n'

/** `{email}` and `{phone}` in any text are replaced with the store contact details. */
export type LegalSection = {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
}

export type LegalDocument = {
  intro: string
  sections: LegalSection[]
}

export type LegalPage = 'privacy' | 'terms'

const en: Record<LegalPage, LegalDocument> = {
  terms: {
    intro:
      'These Terms of Sale apply to every order placed on the Brynoxa website. By placing an order, you confirm that you have read and accepted them.',
    sections: [
      {
        id: 'seller',
        title: '1. Who we are',
        paragraphs: [
          'Brynoxa is an online store selling PCs, laptops, components and accessories, delivered across Morocco. Our business details are shown at the top of this page. You can reach us by email at {email} or by phone and WhatsApp at {phone}.',
        ],
      },
      {
        id: 'products',
        title: '2. Products and prices',
        list: [
          'Prices are shown in Moroccan dirhams (DH), all taxes included.',
          'Delivery fees, when they apply, are shown at checkout before you confirm your order.',
          'Photos are as close to the product as possible but may differ slightly (color, packaging).',
          'Products are offered while stock lasts. If an item becomes unavailable after you order, we contact you to offer an alternative or cancel it at no cost.',
          'If a price is clearly wrong because of a typing error, we will contact you before confirming the order.',
        ],
      },
      {
        id: 'orders',
        title: '3. Placing an order',
        list: [
          'Add products to your cart, fill in your delivery details, then choose “Place order”.',
          'We contact you by phone or WhatsApp to confirm the order before shipping it.',
          'We may cancel an order if we cannot reach you, if the details are incomplete, or if the order looks abnormal or fraudulent.',
          'You can cancel a pending order yourself from your account. Once it is confirmed, contact us with your order number.',
        ],
      },
      {
        id: 'payment',
        title: '4. Payment',
        paragraphs: [
          'Payment is made in cash on delivery: you pay the courier when the package arrives. No card or deposit is required. Check that the package is intact before paying; if it is damaged or wrong, you can refuse it and contact us the same day.',
        ],
      },
      {
        id: 'delivery',
        title: '5. Delivery',
        list: [
          'We deliver across Morocco to the address you provide.',
          'Confirmed orders are packed within 1–2 business days, then usually delivered within 2–5 business days depending on your city.',
          'These times are estimates. We keep you informed of any delay.',
          'Please make sure your address and phone number are correct, and that someone can receive the package.',
        ],
      },
      {
        id: 'returns',
        title: '6. Right of return and refunds',
        paragraphs: [
          'Under Moroccan consumer protection law (Law 31-08), you have a right to withdraw from a distance purchase. Brynoxa gives you 14 days from delivery, more than the legal minimum of 7 days.',
        ],
        list: [
          'Contact us before sending anything back, with your order number.',
          'The product must be unused, complete, and in its original packaging with all accessories.',
          'If the product is defective or not what you ordered, pickup is free. If you simply changed your mind, a courier fee may apply.',
          'After we receive and inspect the product, we refund you by bank transfer or store credit, usually within 3–7 business days.',
          'Products damaged by misuse, or with missing parts, cannot be returned.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Warranty',
        paragraphs: [
          'Eligible products include a 6-month Brynoxa warranty from the delivery date, covering manufacturing defects. Your order number is your proof of purchase.',
          'The warranty does not cover drops, liquid damage, misuse, normal wear, or repairs done outside Brynoxa. This commercial warranty does not remove your legal rights regarding hidden defects.',
        ],
      },
      {
        id: 'liability',
        title: '8. Responsibility',
        paragraphs: [
          'We do our best to describe products accurately and keep the website available. We are not responsible for indirect damage, such as data loss: please back up your data before sending a device for repair or return.',
        ],
      },
      {
        id: 'data',
        title: '9. Personal data',
        paragraphs: [
          'We use your information only to process and deliver your orders and to support you. See our Privacy Policy for details and for your rights.',
        ],
      },
      {
        id: 'law',
        title: '10. Disputes and applicable law',
        paragraphs: [
          'These terms are governed by Moroccan law. If you have a problem, contact us first at {email}: we will look for a friendly solution. If no agreement is found, the competent Moroccan courts will decide.',
        ],
      },
      {
        id: 'changes',
        title: '11. Changes',
        paragraphs: [
          'We may update these terms. The version that applies to your order is the one shown on the website when you placed it.',
        ],
      },
    ],
  },
  privacy: {
    intro:
      'This policy explains what personal information Brynoxa collects, why we use it, and the rights you have over it under Moroccan Law 09-08 on the protection of personal data.',
    sections: [
      {
        id: 'controller',
        title: '1. Who is responsible',
        paragraphs: [
          'Brynoxa is responsible for the personal information collected on this website. Our details are shown at the top of this page. For any privacy question, write to {email}.',
        ],
      },
      {
        id: 'collected',
        title: '2. Information we collect',
        list: [
          'Order and delivery details: full name, phone number, address, city, and the products you order.',
          'Account details, if you create one: name, email address and a password (stored encrypted — we can never read it).',
          'Messages you send us through the contact form, WhatsApp, phone or email.',
          'Reviews you post, your wishlist, and newsletter or notification preferences.',
          'Basic technical data needed to run the website securely, such as your browser type and IP address in security logs.',
        ],
      },
      {
        id: 'use',
        title: '3. Why we use it',
        list: [
          'To confirm, prepare, deliver and follow up on your orders.',
          'To provide warranty, returns and customer support.',
          'To manage your account and keep it secure.',
          'To send news or offers — only if you agreed, and you can stop at any time.',
          'To meet our legal and accounting obligations.',
        ],
      },
      {
        id: 'sharing',
        title: '4. Who we share it with',
        paragraphs: ['We never sell your personal information. We only share what is necessary with:'],
        list: [
          'Delivery companies: your name, phone number and address, so they can deliver your package.',
          'Technical providers that host the website, store its data and send its emails, under confidentiality and security obligations.',
          'Public authorities, only when the law requires it.',
        ],
      },
      {
        id: 'cookies',
        title: '5. Cookies and local storage',
        paragraphs: [
          'We use only what the website needs to work: a secure cookie that keeps you signed in, and storage in your browser for your cart, wishlist, language and theme. We do not use advertising cookies. If we ever add audience measurement, we will ask for your consent first.',
        ],
      },
      {
        id: 'retention',
        title: '6. How long we keep it',
        list: [
          'Order information is kept as long as required by our accounting and legal obligations.',
          'Account information is kept while your account is active. You can ask us to delete it at any time.',
          'Messages are kept for as long as needed to answer and follow up on your request.',
        ],
      },
      {
        id: 'security',
        title: '7. Security',
        paragraphs: [
          'Your information is sent over an encrypted connection (HTTPS). Passwords are encrypted, and only authorized team members can access customer data, with the permissions their role requires.',
        ],
      },
      {
        id: 'rights',
        title: '8. Your rights',
        paragraphs: [
          'Under Law 09-08, you can ask to access your personal information, correct it, or object to its use for legitimate reasons, including deleting your account. Write to {email} from the address linked to your account, or call {phone}. We answer as quickly as possible.',
          'You can also contact the Moroccan data protection authority, the CNDP (www.cndp.ma).',
        ],
      },
      {
        id: 'children',
        title: '9. Children',
        paragraphs: [
          'Our website is intended for adults. If you are under 18, please order with the help of a parent or guardian.',
        ],
      },
      {
        id: 'changes',
        title: '10. Changes to this policy',
        paragraphs: [
          'We may update this policy. The date of the latest version is shown at the top of this page.',
        ],
      },
    ],
  },
}

const fr: Record<LegalPage, LegalDocument> = {
  terms: {
    intro:
      'Les présentes Conditions Générales de Vente s’appliquent à toute commande passée sur le site Brynoxa. En passant commande, vous confirmez les avoir lues et acceptées.',
    sections: [
      {
        id: 'seller',
        title: '1. Qui sommes-nous',
        paragraphs: [
          'Brynoxa est une boutique en ligne de PC, ordinateurs portables, composants et accessoires, livrés partout au Maroc. Nos informations sont indiquées en haut de cette page. Vous pouvez nous joindre par e-mail à {email} ou par téléphone et WhatsApp au {phone}.',
        ],
      },
      {
        id: 'products',
        title: '2. Produits et prix',
        list: [
          'Les prix sont indiqués en dirhams marocains (DH), toutes taxes comprises.',
          'Les frais de livraison, s’il y en a, sont affichés au moment de la commande, avant sa validation.',
          'Les photos sont aussi fidèles que possible mais peuvent légèrement différer (couleur, emballage).',
          'Les produits sont proposés dans la limite des stocks disponibles. Si un article n’est plus disponible après votre commande, nous vous contactons pour proposer une alternative ou l’annuler sans frais.',
          'Si un prix est manifestement erroné à cause d’une faute de saisie, nous vous contactons avant de confirmer la commande.',
        ],
      },
      {
        id: 'orders',
        title: '3. Passer une commande',
        list: [
          'Ajoutez les produits au panier, renseignez vos informations de livraison, puis choisissez « Passer la commande ».',
          'Nous vous contactons par téléphone ou WhatsApp pour confirmer la commande avant l’expédition.',
          'Nous pouvons annuler une commande si nous ne parvenons pas à vous joindre, si les informations sont incomplètes, ou si la commande semble anormale ou frauduleuse.',
          'Vous pouvez annuler vous-même une commande en attente depuis votre compte. Une fois confirmée, contactez-nous avec votre numéro de commande.',
        ],
      },
      {
        id: 'payment',
        title: '4. Paiement',
        paragraphs: [
          'Le paiement se fait en espèces à la livraison : vous payez le livreur à la réception du colis. Aucune carte ni acompte n’est demandé. Vérifiez que le colis est intact avant de payer ; s’il est endommagé ou ne correspond pas, vous pouvez le refuser et nous contacter le jour même.',
        ],
      },
      {
        id: 'delivery',
        title: '5. Livraison',
        list: [
          'Nous livrons partout au Maroc, à l’adresse que vous indiquez.',
          'Les commandes confirmées sont préparées sous 1 à 2 jours ouvrés, puis livrées généralement sous 2 à 5 jours ouvrés selon votre ville.',
          'Ces délais sont indicatifs. Nous vous informons de tout retard.',
          'Assurez-vous que votre adresse et votre numéro de téléphone sont corrects, et que quelqu’un peut recevoir le colis.',
        ],
      },
      {
        id: 'returns',
        title: '6. Droit de rétractation et remboursements',
        paragraphs: [
          'Conformément à la loi marocaine sur la protection du consommateur (loi 31-08), vous disposez d’un droit de rétractation pour les achats à distance. Brynoxa vous accorde 14 jours à compter de la livraison, au-delà du minimum légal de 7 jours.',
        ],
        list: [
          'Contactez-nous avant tout renvoi, avec votre numéro de commande.',
          'Le produit doit être non utilisé, complet et dans son emballage d’origine avec tous ses accessoires.',
          'Si le produit est défectueux ou ne correspond pas à votre commande, l’enlèvement est gratuit. Si vous avez simplement changé d’avis, des frais de livraison peuvent s’appliquer.',
          'Après réception et vérification du produit, nous vous remboursons par virement bancaire ou avoir, généralement sous 3 à 7 jours ouvrés.',
          'Les produits endommagés par une mauvaise utilisation, ou incomplets, ne peuvent pas être retournés.',
        ],
      },
      {
        id: 'warranty',
        title: '7. Garantie',
        paragraphs: [
          'Les produits éligibles bénéficient d’une garantie Brynoxa de 6 mois à compter de la livraison, couvrant les défauts de fabrication. Votre numéro de commande sert de preuve d’achat.',
          'La garantie ne couvre pas les chutes, les dégâts liés aux liquides, la mauvaise utilisation, l’usure normale, ni les réparations effectuées en dehors de Brynoxa. Cette garantie commerciale ne supprime pas vos droits légaux concernant les vices cachés.',
        ],
      },
      {
        id: 'liability',
        title: '8. Responsabilité',
        paragraphs: [
          'Nous faisons de notre mieux pour décrire les produits avec exactitude et garder le site disponible. Nous ne sommes pas responsables des dommages indirects, comme la perte de données : sauvegardez vos données avant d’envoyer un appareil en réparation ou en retour.',
        ],
      },
      {
        id: 'data',
        title: '9. Données personnelles',
        paragraphs: [
          'Nous utilisons vos informations uniquement pour traiter et livrer vos commandes et vous accompagner. Consultez notre Politique de confidentialité pour les détails et vos droits.',
        ],
      },
      {
        id: 'law',
        title: '10. Litiges et droit applicable',
        paragraphs: [
          'Les présentes conditions sont régies par le droit marocain. En cas de problème, contactez-nous d’abord à {email} : nous chercherons une solution amiable. À défaut d’accord, les tribunaux marocains compétents trancheront.',
        ],
      },
      {
        id: 'changes',
        title: '11. Modifications',
        paragraphs: [
          'Nous pouvons mettre à jour ces conditions. La version applicable à votre commande est celle affichée sur le site au moment où vous l’avez passée.',
        ],
      },
    ],
  },
  privacy: {
    intro:
      'Cette politique explique quelles informations personnelles Brynoxa collecte, pourquoi nous les utilisons, et les droits dont vous disposez conformément à la loi marocaine 09-08 relative à la protection des données personnelles.',
    sections: [
      {
        id: 'controller',
        title: '1. Responsable du traitement',
        paragraphs: [
          'Brynoxa est responsable des informations personnelles collectées sur ce site. Nos coordonnées sont indiquées en haut de cette page. Pour toute question sur vos données, écrivez à {email}.',
        ],
      },
      {
        id: 'collected',
        title: '2. Informations collectées',
        list: [
          'Informations de commande et de livraison : nom complet, numéro de téléphone, adresse, ville et produits commandés.',
          'Informations de compte, si vous en créez un : nom, adresse e-mail et mot de passe (chiffré — nous ne pouvons jamais le lire).',
          'Les messages que vous nous envoyez via le formulaire de contact, WhatsApp, téléphone ou e-mail.',
          'Les avis que vous publiez, votre liste d’envies et vos préférences de newsletter ou de notifications.',
          'Des données techniques de base nécessaires au fonctionnement sécurisé du site, comme le type de navigateur et l’adresse IP dans les journaux de sécurité.',
        ],
      },
      {
        id: 'use',
        title: '3. Pourquoi nous les utilisons',
        list: [
          'Pour confirmer, préparer, livrer et suivre vos commandes.',
          'Pour assurer la garantie, les retours et le service client.',
          'Pour gérer votre compte et le sécuriser.',
          'Pour vous envoyer des nouveautés ou offres — uniquement si vous l’avez accepté, et vous pouvez arrêter à tout moment.',
          'Pour respecter nos obligations légales et comptables.',
        ],
      },
      {
        id: 'sharing',
        title: '4. Avec qui nous les partageons',
        paragraphs: [
          'Nous ne vendons jamais vos informations personnelles. Nous partageons uniquement le nécessaire avec :',
        ],
        list: [
          'Les sociétés de livraison : votre nom, téléphone et adresse, pour livrer votre colis.',
          'Les prestataires techniques qui hébergent le site, stockent ses données et envoient ses e-mails, soumis à des obligations de confidentialité et de sécurité.',
          'Les autorités publiques, uniquement lorsque la loi l’exige.',
        ],
      },
      {
        id: 'cookies',
        title: '5. Cookies et stockage local',
        paragraphs: [
          'Nous utilisons uniquement ce dont le site a besoin pour fonctionner : un cookie sécurisé qui vous garde connecté, et un stockage dans votre navigateur pour votre panier, votre liste d’envies, la langue et le thème. Nous n’utilisons pas de cookies publicitaires. Si nous ajoutons un jour une mesure d’audience, nous vous demanderons d’abord votre accord.',
        ],
      },
      {
        id: 'retention',
        title: '6. Durée de conservation',
        list: [
          'Les informations de commande sont conservées aussi longtemps que l’exigent nos obligations comptables et légales.',
          'Les informations de compte sont conservées tant que votre compte est actif. Vous pouvez demander sa suppression à tout moment.',
          'Les messages sont conservés le temps nécessaire pour répondre et suivre votre demande.',
        ],
      },
      {
        id: 'security',
        title: '7. Sécurité',
        paragraphs: [
          'Vos informations transitent par une connexion chiffrée (HTTPS). Les mots de passe sont chiffrés, et seuls les membres autorisés de l’équipe accèdent aux données clients, selon les permissions de leur rôle.',
        ],
      },
      {
        id: 'rights',
        title: '8. Vos droits',
        paragraphs: [
          'Conformément à la loi 09-08, vous pouvez demander l’accès à vos informations personnelles, leur rectification, ou vous opposer à leur utilisation pour des motifs légitimes, y compris la suppression de votre compte. Écrivez à {email} depuis l’adresse liée à votre compte, ou appelez le {phone}. Nous répondons dans les meilleurs délais.',
          'Vous pouvez également contacter l’autorité marocaine de protection des données, la CNDP (www.cndp.ma).',
        ],
      },
      {
        id: 'children',
        title: '9. Mineurs',
        paragraphs: [
          'Notre site s’adresse aux adultes. Si vous avez moins de 18 ans, commandez avec l’aide d’un parent ou tuteur.',
        ],
      },
      {
        id: 'changes',
        title: '10. Modifications de cette politique',
        paragraphs: [
          'Nous pouvons mettre à jour cette politique. La date de la dernière version est indiquée en haut de cette page.',
        ],
      },
    ],
  },
}

const ar: Record<LegalPage, LegalDocument> = {
  terms: {
    intro:
      'تسري شروط البيع هذه على كل طلب يتم عبر موقع Brynoxa. بتأكيدك للطلب، فإنك تقرّ بأنك قرأتها ووافقت عليها.',
    sections: [
      {
        id: 'seller',
        title: '1. من نحن',
        paragraphs: [
          'Brynoxa متجر إلكتروني لبيع الحواسيب المكتبية والمحمولة والمكوّنات والإكسسوارات، مع التوصيل إلى جميع أنحاء المغرب. معلوماتنا التجارية مذكورة في أعلى هذه الصفحة. يمكنك التواصل معنا عبر البريد الإلكتروني {email} أو عبر الهاتف وواتساب على الرقم {phone}.',
        ],
      },
      {
        id: 'products',
        title: '2. المنتجات والأسعار',
        list: [
          'الأسعار معروضة بالدرهم المغربي (DH) وتشمل جميع الضرائب.',
          'تُعرض مصاريف التوصيل، إن وُجدت، عند إتمام الطلب وقبل تأكيده.',
          'الصور أقرب ما يمكن إلى المنتج، لكنها قد تختلف قليلًا (اللون، التغليف).',
          'المنتجات معروضة في حدود المخزون المتوفر. إذا نفد منتج بعد طلبك، نتواصل معك لاقتراح بديل أو إلغائه دون أي تكلفة.',
          'إذا كان السعر خاطئًا بشكل واضح بسبب خطأ في الكتابة، نتواصل معك قبل تأكيد الطلب.',
        ],
      },
      {
        id: 'orders',
        title: '3. إتمام الطلب',
        list: [
          'أضف المنتجات إلى السلة، وأدخل معلومات التوصيل، ثم اضغط على «تأكيد الطلب».',
          'نتواصل معك عبر الهاتف أو واتساب لتأكيد الطلب قبل شحنه.',
          'يمكننا إلغاء الطلب إذا تعذّر التواصل معك، أو كانت المعلومات ناقصة، أو بدا الطلب غير عادي أو احتياليًا.',
          'يمكنك إلغاء الطلب قيد الانتظار بنفسك من حسابك. بعد تأكيده، تواصل معنا مع رقم الطلب.',
        ],
      },
      {
        id: 'payment',
        title: '4. الدفع',
        paragraphs: [
          'يتم الدفع نقدًا عند الاستلام: تدفع لعامل التوصيل عند وصول الطرد. لا حاجة لبطاقة بنكية أو عربون. تحقق من سلامة الطرد قبل الدفع؛ وإذا كان تالفًا أو غير مطابق، يمكنك رفضه والتواصل معنا في نفس اليوم.',
        ],
      },
      {
        id: 'delivery',
        title: '5. التوصيل',
        list: [
          'نوصل إلى جميع أنحاء المغرب، إلى العنوان الذي تحدده.',
          'تُجهَّز الطلبات المؤكدة خلال يوم إلى يومَي عمل، ثم تُسلَّم عادةً خلال 2 إلى 5 أيام عمل حسب مدينتك.',
          'هذه المدد تقريبية، وسنخبرك بأي تأخير.',
          'يرجى التأكد من صحة العنوان ورقم الهاتف، ومن وجود من يستلم الطرد.',
        ],
      },
      {
        id: 'returns',
        title: '6. حق التراجع والاسترجاع',
        paragraphs: [
          'وفقًا للقانون المغربي لحماية المستهلك (القانون 31-08)، لديك حق التراجع عن الشراء عن بُعد. تمنحك Brynoxa مهلة 14 يومًا من تاريخ الاستلام، أي أكثر من الحد الأدنى القانوني البالغ 7 أيام.',
        ],
        list: [
          'تواصل معنا قبل إرجاع أي منتج، مع ذكر رقم الطلب.',
          'يجب أن يكون المنتج غير مستعمل وكاملًا وفي علبته الأصلية مع جميع ملحقاته.',
          'إذا كان المنتج معيبًا أو غير مطابق لطلبك، يكون الاستلام مجانيًا. أما إذا غيّرت رأيك فقط، فقد تُطبَّق مصاريف التوصيل.',
          'بعد استلام المنتج وفحصه، نعيد لك المبلغ عبر تحويل بنكي أو رصيد شراء، عادةً خلال 3 إلى 7 أيام عمل.',
          'لا يمكن إرجاع المنتجات التي تضررت بسبب سوء الاستعمال أو الناقصة.',
        ],
      },
      {
        id: 'warranty',
        title: '7. الضمان',
        paragraphs: [
          'تستفيد المنتجات المؤهلة من ضمان Brynoxa لمدة 6 أشهر من تاريخ الاستلام، يغطي عيوب التصنيع. رقم طلبك هو إثبات الشراء.',
          'لا يشمل الضمان السقوط أو أضرار السوائل أو سوء الاستعمال أو التآكل العادي أو الإصلاحات التي تتم خارج Brynoxa. هذا الضمان التجاري لا يلغي حقوقك القانونية المتعلقة بالعيوب الخفية.',
        ],
      },
      {
        id: 'liability',
        title: '8. المسؤولية',
        paragraphs: [
          'نبذل قصارى جهدنا لوصف المنتجات بدقة والحفاظ على توفر الموقع. لسنا مسؤولين عن الأضرار غير المباشرة مثل فقدان البيانات: يرجى حفظ نسخة من بياناتك قبل إرسال أي جهاز للإصلاح أو الإرجاع.',
        ],
      },
      {
        id: 'data',
        title: '9. المعطيات الشخصية',
        paragraphs: [
          'نستخدم معلوماتك فقط لمعالجة طلباتك وتوصيلها ومساعدتك. اطّلع على سياسة الخصوصية لمعرفة التفاصيل وحقوقك.',
        ],
      },
      {
        id: 'law',
        title: '10. النزاعات والقانون المطبّق',
        paragraphs: [
          'تخضع هذه الشروط للقانون المغربي. في حال وجود مشكلة، تواصل معنا أولًا عبر {email} وسنبحث عن حل ودّي. وفي حال عدم الاتفاق، تختص المحاكم المغربية المختصة بالنظر في النزاع.',
        ],
      },
      {
        id: 'changes',
        title: '11. التعديلات',
        paragraphs: [
          'يمكننا تحديث هذه الشروط. النسخة التي تسري على طلبك هي المعروضة على الموقع وقت إتمامه.',
        ],
      },
    ],
  },
  privacy: {
    intro:
      'توضح هذه السياسة المعلومات الشخصية التي تجمعها Brynoxa، وسبب استخدامها، والحقوق التي تتمتع بها وفقًا للقانون المغربي 09-08 المتعلق بحماية المعطيات ذات الطابع الشخصي.',
    sections: [
      {
        id: 'controller',
        title: '1. المسؤول عن المعالجة',
        paragraphs: [
          'Brynoxa مسؤولة عن المعلومات الشخصية التي يتم جمعها على هذا الموقع. معلوماتنا مذكورة في أعلى هذه الصفحة. لأي سؤال يتعلق بمعطياتك، راسلنا على {email}.',
        ],
      },
      {
        id: 'collected',
        title: '2. المعلومات التي نجمعها',
        list: [
          'معلومات الطلب والتوصيل: الاسم الكامل، رقم الهاتف، العنوان، المدينة والمنتجات المطلوبة.',
          'معلومات الحساب إذا أنشأت حسابًا: الاسم، البريد الإلكتروني وكلمة المرور (مشفّرة — لا يمكننا قراءتها أبدًا).',
          'الرسائل التي ترسلها لنا عبر نموذج الاتصال أو واتساب أو الهاتف أو البريد الإلكتروني.',
          'التقييمات التي تنشرها، وقائمة الأمنيات، وتفضيلات النشرة الإخبارية أو الإشعارات.',
          'معطيات تقنية أساسية لازمة لتشغيل الموقع بأمان، مثل نوع المتصفح وعنوان IP في سجلات الأمان.',
        ],
      },
      {
        id: 'use',
        title: '3. لماذا نستخدمها',
        list: [
          'لتأكيد طلباتك وتجهيزها وتوصيلها ومتابعتها.',
          'لتقديم خدمات الضمان والإرجاع ودعم العملاء.',
          'لإدارة حسابك والحفاظ على أمانه.',
          'لإرسال المستجدات أو العروض — فقط إذا وافقت، ويمكنك الإيقاف في أي وقت.',
          'للوفاء بالتزاماتنا القانونية والمحاسبية.',
        ],
      },
      {
        id: 'sharing',
        title: '4. مع من نشاركها',
        paragraphs: ['لا نبيع معلوماتك الشخصية أبدًا. نشارك فقط ما هو ضروري مع:'],
        list: [
          'شركات التوصيل: اسمك ورقم هاتفك وعنوانك، لتوصيل طردك.',
          'مزوّدي الخدمات التقنية الذين يستضيفون الموقع ويخزّنون بياناته ويرسلون رسائله الإلكترونية، مع التزامهم بالسرية والأمان.',
          'السلطات العمومية، فقط عندما يفرض القانون ذلك.',
        ],
      },
      {
        id: 'cookies',
        title: '5. ملفات تعريف الارتباط والتخزين المحلي',
        paragraphs: [
          'نستخدم فقط ما يحتاجه الموقع للعمل: ملف ارتباط آمن يبقيك مسجّل الدخول، وتخزين في متصفحك للسلة وقائمة الأمنيات واللغة والمظهر. لا نستخدم ملفات ارتباط إعلانية. وإذا أضفنا يومًا أداة لقياس الزيارات، فسنطلب موافقتك أولًا.',
        ],
      },
      {
        id: 'retention',
        title: '6. مدة الاحتفاظ',
        list: [
          'نحتفظ بمعلومات الطلبات طوال المدة التي تفرضها التزاماتنا المحاسبية والقانونية.',
          'نحتفظ بمعلومات الحساب ما دام حسابك نشطًا، ويمكنك طلب حذفه في أي وقت.',
          'نحتفظ بالرسائل المدة اللازمة للرد على طلبك ومتابعته.',
        ],
      },
      {
        id: 'security',
        title: '7. الأمان',
        paragraphs: [
          'تُنقل معلوماتك عبر اتصال مشفّر (HTTPS). كلمات المرور مشفّرة، ولا يصل إلى بيانات العملاء إلا أعضاء الفريق المخوَّلون، وفق صلاحيات أدوارهم.',
        ],
      },
      {
        id: 'rights',
        title: '8. حقوقك',
        paragraphs: [
          'وفقًا للقانون 09-08، يمكنك طلب الاطلاع على معلوماتك الشخصية أو تصحيحها أو الاعتراض على استخدامها لأسباب مشروعة، بما في ذلك حذف حسابك. راسلنا على {email} من البريد المرتبط بحسابك، أو اتصل على {phone}. نرد في أقرب وقت ممكن.',
          'يمكنك أيضًا التواصل مع اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي CNDP (www.cndp.ma).',
        ],
      },
      {
        id: 'children',
        title: '9. القاصرون',
        paragraphs: [
          'موقعنا موجّه للبالغين. إذا كان عمرك أقل من 18 سنة، يرجى الطلب بمساعدة أحد الوالدين أو الوصي.',
        ],
      },
      {
        id: 'changes',
        title: '10. تعديل هذه السياسة',
        paragraphs: ['يمكننا تحديث هذه السياسة. تاريخ آخر نسخة مذكور في أعلى هذه الصفحة.'],
      },
    ],
  },
}

export const LEGAL_CONTENT: Record<Locale, Record<LegalPage, LegalDocument>> = { en, fr, ar }
