import type { HelpGuide } from './types'

/** Centre d’aide en français. Mêmes ids que en.ts et ar.ts. */
export const fr: HelpGuide = {
  sections: [
    {
      id: 'getting-started',
      icon: 'search',
      title: 'Premiers pas',
      description: 'Trouvez PC, portables, composants et accessoires en quelques clics.',
      topics: [
        {
          id: 'browse',
          title: 'Parcourir la boutique',
          summary:
            'Ouvrez Boutique dans le menu pour voir tous les produits. Sur la page d’accueil, les catégories mènent directement aux portables, PC gamer, composants, écrans et accessoires.',
          points: [
            'Chaque fiche affiche la photo, le prix en DH, la remise éventuelle et la disponibilité.',
            'Touchez une fiche pour ouvrir la page complète du produit.',
            'Sur téléphone, choisissez un ou deux produits par ligne avec les boutons au-dessus de la liste.',
          ],
          keywords: 'catalogue produits accueil categories menu boutique',
          links: [{ to: '/shop', label: 'Ouvrir la boutique' }],
        },
        {
          id: 'search',
          title: 'Rechercher un produit',
          summary:
            'Utilisez la barre de recherche en haut de chaque page (la loupe sur téléphone). Des suggestions apparaissent pendant la saisie : produits et catégories correspondantes.',
          steps: [
            'Tapez un nom de produit, une marque (HP, ASUS, Lenovo…) ou un composant (RTX, i7, 16 Go…).',
            'Choisissez une suggestion pour l’ouvrir, ou appuyez sur Entrée pour voir tous les résultats.',
            'Affinez les résultats avec les filtres, comme dans la boutique.',
          ],
          points: ['Sur ordinateur, appuyez sur la touche / pour aller directement à la recherche.'],
          keywords: 'trouver chercher recherche barre mot cle marque',
          links: [{ to: '/search', label: 'Rechercher' }],
        },
        {
          id: 'filters',
          title: 'Catégories, filtres et tri',
          summary: 'Réduisez une longue liste aux produits qui correspondent à vos besoins et à votre budget.',
          points: [
            'Catégorie et marque : gardez seulement les produits qui vous intéressent.',
            'Prix (DH) : choisissez une tranche toute prête ou saisissez votre minimum et maximum.',
            'En stock uniquement : masque les produits indisponibles pour le moment.',
            'Tri : nouveautés, prix croissant, prix décroissant ou les plus populaires.',
            'Sur téléphone, ouvrez le bouton Filtres puis touchez « Voir … produits ». « Effacer les filtres » remet tout à zéro.',
          ],
          keywords: 'filtre marque prix tranche budget tri moins cher stock',
          links: [{ to: '/shop', label: 'Parcourir avec les filtres' }],
        },
        {
          id: 'compare',
          title: 'Comparer des produits',
          summary:
            'Vous hésitez entre deux portables ? Ajoutez jusqu’à 4 produits au comparateur et voyez-les côte à côte, point par point.',
          steps: [
            'Touchez le bouton comparer sur une fiche ou une page produit.',
            'Ouvrez Comparer depuis la barre du haut (l’icône des calques) ou le menu.',
            'Activez « Voir seulement les différences » pour voir ce qui change vraiment. La meilleure valeur de chaque ligne est mise en avant, et « Notre choix » indique le produit qui gagne le plus de points.',
          ],
          keywords: 'comparer comparateur cote a cote versus difference',
          links: [{ to: '/compare', label: 'Ouvrir le comparateur' }],
        },
      ],
    },
    {
      id: 'product-pages',
      icon: 'monitor',
      title: 'Comprendre une page produit',
      description: 'Photos, caractéristiques, stock, état et accessoires assortis.',
      topics: [
        {
          id: 'product-details',
          title: 'Photos, description et caractéristiques',
          summary: 'Tout ce qui concerne un produit se trouve sur sa page.',
          points: [
            'Faites défiler les photos. Elles sont aussi proches que possible du produit, mais la couleur et l’emballage peuvent légèrement différer.',
            'La description explique à quoi sert le produit.',
            'Les caractéristiques affichent d’abord l’essentiel. Ouvrez « Toutes les caractéristiques » pour la liste complète.',
            'Le prix est en dirhams (DH), toutes taxes comprises. Un prix barré signifie que le produit est en promotion.',
            '« Autres configurations disponibles » signifie que le produit existe en d’autres versions (mémoire, stockage…). Choisissez la vôtre avant de l’ajouter au panier.',
          ],
          keywords: 'caracteristiques fiche technique photo image description prix promotion variante version option',
        },
        {
          id: 'availability',
          title: 'Stock et disponibilité',
          summary: 'La page produit et les fiches indiquent si vous pouvez commander maintenant.',
          points: [
            'En stock : vous pouvez le commander tout de suite.',
            'Plus que quelques pièces : le nombre affiché est ce qui reste.',
            'Rupture de stock : il ne peut pas être commandé pour le moment. Demandez-nous sur WhatsApp s’il revient bientôt.',
            'Le stock est vérifié à nouveau quand vous passez la commande. S’il a changé, la page de commande vous demande d’ajuster la quantité.',
          ],
          keywords: 'stock disponible disponibilite rupture epuise reste',
          links: [{ to: '/contact', label: 'Poser une question' }],
        },
        {
          id: 'condition',
          title: 'Neuf, reconditionné ou d’occasion',
          summary:
            'Les produits sont neufs sauf indication contraire. Les produits reconditionnés et d’occasion sont signalés comme tels et affichent un avis sur leur page : vous savez toujours ce que vous achetez.',
          keywords: 'etat neuf reconditionne occasion seconde main',
        },
        {
          id: 'complete-setup',
          title: 'Complétez votre équipement',
          summary:
            'Sous de nombreux produits, « Complétez votre équipement » propose des accessoires qui vont bien avec, comme une souris, un casque ou une sacoche pour un portable.',
          steps: [
            'Descendez jusqu’à « Complétez votre équipement » sur la page produit.',
            'Touchez une suggestion pour voir ses détails, ou utilisez Ajouter pour la mettre directement au panier.',
            'Tout se retrouve dans le même panier et la même commande payée à la livraison.',
          ],
          keywords: 'accessoires compatible setup pack souris clavier casque recommande',
        },
        {
          id: 'add-to-cart',
          title: 'Ajouter au panier ou acheter maintenant',
          summary:
            'Ajouter au panier vous laisse continuer vos achats. Acheter maintenant vous emmène directement à la commande avec le produit.',
          points: [
            'Les produits similaires en bas de page vous aident à comparer avant de choisir.',
            'Une question avant ? Touchez WhatsApp sous les boutons : votre message sur ce produit est prêt à envoyer.',
          ],
          keywords: 'ajouter au panier acheter maintenant',
        },
      ],
    },
    {
      id: 'account',
      icon: 'user',
      title: 'Votre compte',
      description: 'Inscription, coordonnées, adresses et commandes.',
      topics: [
        {
          id: 'register',
          title: 'Créer un compte et se connecter',
          summary:
            'Le compte est facultatif : vous pouvez commander en invité. Avec un compte, vos commandes sont au même endroit et vos coordonnées sont remplies pour la prochaine fois.',
          steps: [
            'Choisissez Se connecter en haut de la page, puis « Créer un compte ».',
            'Saisissez votre nom, votre email et un mot de passe.',
            'Vous pouvez aussi cocher « Créer un compte » au moment de commander en invité.',
          ],
          points: [
            'Si vous avez déjà commandé en invité avec le même email, nous envoyons un lien à cette adresse pour confirmer qu’elle est à vous.',
          ],
          keywords: 'inscription s inscrire connexion se connecter creer compte invite',
          links: [
            { to: '/register', label: 'Créer un compte' },
            { to: '/login', label: 'Se connecter' },
          ],
        },
        {
          id: 'profile',
          title: 'Modifier vos coordonnées et adresses',
          summary: 'Ouvrez Compte → Paramètres pour changer votre nom et votre téléphone et gérer vos adresses de livraison.',
          points: [
            'Adresses : ajoutez-en une avec un libellé (Maison, Travail…), le nom du destinataire, l’adresse, la ville et le téléphone. Supprimez celles que vous n’utilisez plus.',
            'Au moment de commander, choisissez une adresse enregistrée au lieu de la retaper.',
            'Votre email sert à vous connecter et ne se change pas depuis la page. Contactez-nous s’il doit changer.',
            'Changez votre mot de passe sur la même page.',
          ],
          keywords: 'profil parametres adresse telephone nom modifier changer mot de passe',
          links: [{ to: '/account/settings', label: 'Ouvrir les paramètres' }],
        },
        {
          id: 'account-orders',
          title: 'Commandes et notifications',
          summary:
            'Compte → Commandes liste toutes vos commandes avec leur statut. Compte → Notifications garde les nouvelles de vos commandes.',
          points: [
            'Vous pouvez aussi autoriser les notifications sur votre téléphone ou ordinateur pour être prévenu quand votre commande est confirmée, expédiée et livrée.',
          ],
          keywords: 'historique mes commandes notifications alertes',
          links: [
            { to: '/account/orders', label: 'Voir mes commandes' },
            { to: '/account/notifications', label: 'Notifications' },
          ],
        },
        {
          id: 'password',
          title: 'Mot de passe oublié ?',
          summary:
            'Choisissez « Mot de passe oublié » sur la page de connexion et saisissez votre email pour recevoir un lien et en choisir un nouveau.',
          points: [
            'Le lien est valable un temps limité. S’il a expiré, demandez-en un nouveau.',
            'Pas d’email après quelques minutes ? Regardez dans les spams, ou contactez-nous sur WhatsApp et nous vous aiderons à retrouver l’accès.',
          ],
          keywords: 'mot de passe oublie reinitialiser recuperer acces impossible connexion',
          links: [{ to: '/forgot-password', label: 'Réinitialiser mon mot de passe' }],
        },
      ],
    },
    {
      id: 'checkout',
      icon: 'cart',
      title: 'Panier et commande',
      description: 'Du panier à la commande passée, étape par étape.',
      topics: [
        {
          id: 'cart',
          title: 'Gérer votre panier',
          summary: 'Ouvrez le panier avec l’icône du sac en haut de la page.',
          points: [
            'Changez les quantités avec + et −, ou retirez un produit.',
            'Le récapitulatif affiche le sous-total et la livraison à partir du tarif le plus bas. Le montant exact dépend de votre ville et s’affiche au moment de commander.',
            'Quand la livraison est offerte à partir d’un certain montant, le panier indique ce qu’il reste pour l’atteindre.',
            'Votre panier est gardé sur cet appareil jusqu’à la commande.',
          ],
          keywords: 'panier quantite retirer modifier sous total livraison gratuite',
          links: [{ to: '/cart', label: 'Ouvrir mon panier' }],
        },
        {
          id: 'place-order',
          title: 'Passer une commande',
          summary: 'La commande prend environ une minute. Aucune carte n’est nécessaire.',
          steps: [
            'Dans le panier, choisissez Commander.',
            'Saisissez votre nom complet, téléphone, adresse et ville (connecté ? choisissez une adresse enregistrée). En invité, ajoutez aussi un email.',
            'Facultatif : ajoutez un code promo et une note pour la livraison (par exemple le meilleur moment pour appeler).',
            'Vérifiez le récapitulatif : produits, remise, livraison pour votre ville et total à payer.',
            'Choisissez « Passer la commande COD ».',
          ],
          points: [
            'Donnez un numéro sur lequel vous répondez : nous vous appelons ou écrivons pour confirmer la commande avant l’expédition.',
            'Passer commande signifie que vous acceptez les Conditions de vente.',
          ],
          keywords: 'commander commande acheter adresse telephone ville coupon code promo note',
          links: [
            { to: '/checkout', label: 'Passer commande' },
            { to: '/terms#orders', label: 'Conditions : passer commande' },
          ],
        },
        {
          id: 'order-placed',
          title: 'Comment savoir que c’est fait',
          summary:
            'Après la commande, une page de confirmation affiche votre numéro de commande (il commence par BRX-) et le montant à payer à la livraison.',
          points: [
            'Gardez ce numéro : il sert à suivre la commande, à demander de l’aide et pour la garantie.',
            'Connecté ? La commande apparaît aussi dans Compte → Commandes.',
            'Nous vous contactons ensuite pour la confirmer avant de la préparer.',
          ],
          keywords: 'confirmation numero de commande reussi passee BRX',
        },
        {
          id: 'guest-checkout',
          title: 'Commander sans compte',
          summary:
            'Vous pouvez commander en invité avec votre nom, téléphone, adresse et email. Suivez ensuite la commande avec son numéro et le téléphone de livraison.',
          points: ['Vous voulez un compte ? Cochez « Créer un compte » au moment de commander et choisissez un mot de passe.'],
          keywords: 'invite sans compte',
          links: [{ to: '/track-order', label: 'Suivre une commande invité' }],
        },
      ],
    },
    {
      id: 'orders',
      icon: 'package',
      title: 'Commandes et suivi',
      description: 'Suivez votre commande, comprenez son statut et modifiez-la tant que c’est possible.',
      topics: [
        {
          id: 'track-order',
          title: 'Suivre votre commande',
          summary:
            'Connecté, ouvrez Compte → Commandes. Sans compte, utilisez Suivre ma commande avec le numéro de commande et le téléphone de livraison.',
          steps: [
            'Ouvrez Suivre ma commande (en bas de chaque page).',
            'Saisissez le numéro de commande (BRX-…) et le téléphone de livraison.',
            'Choisissez « Trouver la commande » pour voir son statut et son historique.',
          ],
          keywords: 'suivre suivi ou est ma commande statut',
          links: [
            { to: '/track-order', label: 'Suivre une commande' },
            { to: '/account/orders', label: 'Voir mes commandes' },
          ],
        },
        {
          id: 'statuses',
          title: 'Ce que veut dire chaque statut',
          summary: 'Le statut indique où en est votre commande.',
          points: [
            'En attente : nous avons reçu votre commande et allons vous contacter pour la confirmer.',
            'En attente de votre réponse : nous avons essayé de vous joindre. Répondez à notre appel ou écrivez-nous, sinon la commande ne peut pas avancer.',
            'Confirmée : votre commande est confirmée et en préparation.',
            'Expédiée : le livreur a votre colis.',
            'Échec de livraison : le livreur n’a pas pu livrer. Nous vous contactons pour réessayer.',
            'Livraison reportée : une nouvelle date a été convenue. Elle s’affiche sur votre commande.',
            'Livrée : vous avez reçu votre commande. La garantie commence à cette date.',
            'Retour demandé / retour en cours / retournée : votre retour est en cours ou terminé. « Partiellement retournée » signifie que seuls certains articles sont revenus.',
            'Annulée : la commande est annulée et rien n’est dû.',
          ],
          keywords: 'statut en attente confirmee expediee livree annulee echec reportee pas de reponse retournee signification',
        },
        {
          id: 'change-order',
          title: 'Modifier ou annuler une commande',
          summary: 'Tant qu’une commande est En attente, vous pouvez la modifier ou l’annuler vous-même depuis sa page.',
          points: [
            'Gérer la commande : ajoutez ou retirez des produits ou changez les quantités, puis enregistrez pour mettre à jour le total.',
            'Annuler la commande : arrête la commande. Rien n’est dû à la livraison.',
            'Déjà confirmée ? Contactez-nous avec votre numéro de commande et nous verrons ce qui est possible.',
            'Besoin de changer l’adresse ou le téléphone ? Écrivez-nous au plus vite avec votre numéro de commande.',
          ],
          keywords: 'annuler modifier changer commande adresse quantite',
          links: [
            { to: '/account/orders', label: 'Voir mes commandes' },
            { to: '/contact', label: 'Contacter le support' },
          ],
        },
        {
          id: 'delays',
          title: 'Commande en retard ou livraison échouée',
          summary:
            'Les commandes confirmées sont en général préparées sous 1 à 2 jours ouvrés et livrées sous 2 à 5 jours ouvrés selon votre ville. Ce sont des estimations.',
          points: [
            'Regardez d’abord le statut : une livraison reportée affiche sa nouvelle date.',
            'Si le livreur n’a pas pu vous joindre, le statut devient « Échec de livraison ». Gardez votre téléphone près de vous : nous vous contactons pour une nouvelle tentative.',
            'Plus long que prévu ? Envoyez-nous votre numéro de commande sur WhatsApp et nous vérifions avec le livreur.',
          ],
          keywords: 'retard en retard pas arrive livraison echouee livreur rate',
          links: [
            { to: '/services/home-delivery', label: 'Livraison à domicile' },
            { to: '/contact', label: 'Contacter le support' },
          ],
        },
      ],
    },
    {
      id: 'payments',
      icon: 'banknote',
      title: 'Paiement',
      description: 'Paiement à la livraison, et l’acompte demandé pour certaines commandes.',
      topics: [
        {
          id: 'cod',
          title: 'Paiement à la livraison',
          summary:
            'Vous payez le livreur en espèces à l’arrivée du colis. Aucune carte n’est nécessaire et rien n’est prélevé en ligne.',
          steps: [
            'Passez votre commande : le total à payer à la livraison s’affiche avant de confirmer.',
            'À l’arrivée du livreur, vérifiez que le colis est intact et correspond à votre commande.',
            'Payez le montant dû en espèces.',
            'Si le colis est abîmé ou ne correspond pas, vous pouvez le refuser. Contactez-nous le jour même.',
          ],
          keywords: 'paiement a la livraison especes cash livreur sans carte moyen de paiement',
          links: [
            { to: '/services/cash-on-delivery', label: 'Paiement à la livraison' },
            { to: '/terms#payment', label: 'Conditions : paiement' },
          ],
        },
        {
          id: 'deposit',
          title: 'Les commandes avec acompte',
          summary:
            'La plupart des commandes se paient entièrement à la livraison. Certains produits demandent un acompte avant que nous confirmions la commande. La page produit l’indique, avec le montant.',
          points: [
            'Calcul : chaque produit fixe son acompte, soit un montant par unité, soit un pourcentage de son prix. L’acompte d’une commande est la somme pour ses produits, jamais plus que la commande elle-même.',
            'Avant de commander : la page de commande affiche l’acompte et le reste à payer à la livraison.',
            'Après la commande : votre page de commande indique comment payer (les moyens disponibles, comme un virement), puis utilisez « Envoyer la preuve de paiement » avec la référence ou une photo du reçu.',
            'Nous vérifions le paiement, puis confirmons la commande.',
            'À la livraison, vous payez seulement le reste : le total moins l’acompte.',
          ],
          keywords: 'acompte avance depot virement preuve recu partiel',
          links: [{ to: '/account/orders', label: 'Payer un acompte depuis mes commandes' }],
        },
        {
          id: 'coupons',
          title: 'Codes promo et remises',
          summary:
            'Vous avez un code promo ? Saisissez-le dans « Coupon et note » au moment de commander et choisissez Appliquer. La remise apparaît dans le récapitulatif avant de valider.',
          keywords: 'coupon code promo remise reduction bon',
        },
      ],
    },
    {
      id: 'delivery',
      icon: 'truck',
      title: 'Expédition et livraison à domicile',
      description: 'Où nous livrons, les frais et ce qui se passe après l’expédition.',
      topics: [
        {
          id: 'delivery-info',
          title: 'Zones et frais de livraison',
          summary: 'Nous livrons à domicile partout au Maroc uniquement, à l’adresse donnée lors de la commande.',
          points: [
            'Les frais de livraison dépendent de votre ville et s’affichent dès que vous la choisissez.',
            'La livraison est offerte à partir d’un certain montant quand l’offre est active : le panier l’indique.',
            'Vérifiez que l’adresse et le téléphone sont complets et exacts, et que quelqu’un peut recevoir le colis.',
          ],
          keywords: 'expedition livraison frais cout prix ville maroc livraison gratuite',
          links: [
            { to: '/services/home-delivery', label: 'Livraison à domicile' },
            { to: '/terms#delivery', label: 'Conditions : livraison' },
          ],
        },
        {
          id: 'after-shipping',
          title: 'Après l’expédition',
          summary:
            'Le statut passe à Expédiée et le livreur apporte le colis à l’adresse indiquée. Gardez votre téléphone près de vous pour qu’il puisse vous joindre.',
          points: [
            'Notifications autorisées ? Vous êtes prévenu quand la commande est expédiée et quand elle est livrée.',
            'Vérifiez le colis avant de payer. Vous pouvez refuser un colis abîmé ou erroné.',
          ],
          keywords: 'expediee livreur en route jour de livraison',
        },
        {
          id: 'not-available',
          title: 'Absent, ou un problème d’adresse ?',
          summary: 'Prévenez-nous le plus tôt possible pour que nous puissions nous arranger avec le livreur.',
          points: [
            'Absent le jour de la livraison : écrivez-nous avec votre numéro de commande et un meilleur jour ou horaire, ou demandez à quelqu’un de recevoir le colis.',
            'Adresse fausse ou incomplète : envoyez la bonne adresse sur WhatsApp avec votre numéro de commande.',
            'Après une tentative échouée, répondez à notre appel ou message pour programmer une nouvelle livraison.',
          ],
          keywords: 'absent pas a la maison mauvaise adresse changer adresse indisponible',
          links: [{ to: '/contact', label: 'Contacter le support' }],
        },
      ],
    },
    {
      id: 'returns',
      icon: 'shield',
      title: 'Retours, remboursements et garantie',
      description: 'Retours sous 14 jours et garantie de 6 mois. Les Conditions de vente font foi.',
      topics: [
        {
          id: 'return-policy',
          title: 'Politique de retour',
          summary:
            'Vous avez 14 jours après la livraison pour retourner un produit, s’il est non utilisé, complet et dans son emballage d’origine avec tous ses accessoires.',
          points: [
            'Les produits abîmés par une mauvaise utilisation, ou incomplets, ne peuvent pas être retournés.',
            'Produit défectueux ou erroné : l’enlèvement est gratuit. Simple changement d’avis : des frais de livreur peuvent s’appliquer.',
            'Un échange contre un autre modèle est possible s’il est en stock : vous payez ou recevez la différence de prix.',
          ],
          keywords: 'politique de retour 14 jours renvoyer changement d avis echange conditions',
          links: [
            { to: '/services/returns', label: 'Retours' },
            { to: '/terms#returns', label: 'Conditions : retours et remboursements' },
          ],
        },
        {
          id: 'request-return',
          title: 'Demander un retour',
          summary: 'Contactez-nous d’abord. N’envoyez rien avant notre confirmation.',
          steps: [
            'Écrivez-nous sur WhatsApp (sujet « Retour ») ou via le formulaire de contact, avec votre numéro de commande et la raison.',
            'Attendez notre confirmation : nous vous expliquons comment se passe l’enlèvement.',
            'Remettez au livreur le produit complet, dans son emballage d’origine.',
            'Nous l’inspectons à réception, puis nous l’échangeons ou vous remboursons.',
          ],
          keywords: 'demander retour comment retourner renvoyer',
          links: [{ to: '/contact', label: 'Demander un retour' }],
        },
        {
          id: 'refunds',
          title: 'Remboursements',
          summary:
            'Après réception et inspection du produit retourné, nous vous remboursons par virement bancaire ou en avoir, en général sous 3 à 7 jours ouvrés.',
          points: [
            'Si le produit ne remplit pas les conditions de retour, nous vous contactons pour vous l’expliquer avant toute chose.',
          ],
          keywords: 'remboursement rembourser argent avoir virement',
          links: [{ to: '/terms#returns', label: 'Conditions : retours et remboursements' }],
        },
        {
          id: 'warranty',
          title: 'Garantie',
          summary:
            'Les produits éligibles bénéficient d’une garantie Brynoxa de 6 mois à partir de la livraison, contre les défauts de fabrication. Votre numéro de commande sert de preuve d’achat.',
          points: [
            'Non couverts : chutes, liquides, mauvaise utilisation, usure normale et réparations faites hors de Brynoxa.',
            'Cette garantie ne retire pas vos droits légaux concernant les vices cachés.',
          ],
          keywords: 'garantie 6 mois defaut panne couverture',
          links: [
            { to: '/services/warranty', label: 'Garantie' },
            { to: '/terms#warranty', label: 'Conditions : garantie' },
          ],
        },
        {
          id: 'warranty-claim',
          title: 'Demander une prise en garantie',
          summary: 'Un produit ne fonctionne plus ou présente un défaut ? Voici quoi faire.',
          steps: [
            'Écrivez-nous sur WhatsApp (sujet « Garantie ») avec votre numéro de commande.',
            'Ajoutez une photo ou une courte vidéo du problème.',
            'Nous confirmons la prise en charge et organisons l’enlèvement ou le dépôt.',
            'Après diagnostic, nous réparons, remplaçons ou vous accordons un avoir.',
          ],
          keywords: 'prise en garantie reclamation en panne defectueux ne marche pas',
          links: [{ to: '/contact', label: 'Contacter le support' }],
        },
      ],
    },
    {
      id: 'repair',
      icon: 'wrench',
      title: 'Réparation et aide technique',
      description: 'Que faire quand un produit pose problème.',
      topics: [
        {
          id: 'repair-service',
          title: 'Service de réparation',
          summary:
            'Si un produit tombe en panne pendant la garantie, nous le diagnostiquons puis le réparons ou le remplaçons. Hors garantie, une réparation peut faire l’objet d’un devis.',
          steps: [
            'Envoyez-nous une courte vidéo du problème avec votre numéro de commande.',
            'Après accord, nous organisons l’enlèvement.',
            'Nous vous communiquons le résultat du diagnostic et ce que nous allons faire.',
          ],
          points: [
            'Sauvegardez vos données avant d’envoyer un appareil : nous ne sommes pas responsables d’une perte de données.',
            'N’ouvrez pas le produit vous-même : cela peut annuler la garantie.',
          ],
          keywords: 'reparation reparer technicien diagnostic sav panne hors garantie devis',
          links: [{ to: '/services/repair', label: 'Service de réparation' }],
        },
        {
          id: 'prepare',
          title: 'À préparer avant de nous contacter',
          summary: 'Ces informations nous aident à vous répondre plus vite.',
          points: [
            'Votre numéro de commande (BRX-…).',
            'Le nom du produit, et une photo ou une courte vidéo du problème.',
            'Ce que vous avez déjà essayé (autre câble, autre prise, redémarrage).',
            'Pour un conseil : votre budget et l’usage prévu.',
          ],
          keywords: 'informations preparer numero de commande video photo',
        },
        {
          id: 'product-issue',
          title: 'Un produit ne fonctionne pas comme prévu',
          summary: 'Commencez par les vérifications simples, puis contactez-nous.',
          steps: [
            'Vérifiez les câbles et l’alimentation, et redémarrez l’appareil.',
            'Colis abîmé ou mauvais produit à la livraison ? Refusez-le si possible et contactez-nous le jour même.',
            'Problème après la livraison ? Écrivez-nous sur WhatsApp avec votre numéro de commande et une vidéo : nous vous disons s’il s’agit d’un retour, d’une réparation sous garantie ou d’un réglage.',
          ],
          keywords: 'probleme ne marche pas ne s allume pas abime aide',
          links: [{ to: '/contact', label: 'Contacter le support' }],
        },
      ],
    },
    {
      id: 'support',
      icon: 'chat',
      title: 'Contacter le support',
      description: 'De vraies personnes répondent sur WhatsApp, par téléphone et par email.',
      topics: [
        {
          id: 'contact-channels',
          title: 'Comment nous joindre',
          summary:
            'WhatsApp est le plus rapide. Vous pouvez aussi nous appeler, nous écrire par email ou utiliser le formulaire de la page Contact. Nous répondons en général le jour ouvré même.',
          points: [
            'Horaires : du lundi au vendredi 9h–18h, le samedi 10h–16h, fermé le dimanche.',
            'Sur la page Contact, choisissez un sujet WhatsApp (ma commande, aidez-moi à choisir, garantie, retour…) : votre message est rédigé pour vous.',
            'Il n’y a pas de magasin physique : nous livrons partout au Maroc.',
          ],
          keywords: 'contact whatsapp telephone email appeler support aide horaires',
          links: [
            { to: '/contact', label: 'Contacter le support' },
            { to: '/services/live-support', label: 'Support en direct' },
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      id: 'faq-card',
      q: 'Faut-il une carte bancaire pour commander ?',
      a: 'Non. Vous payez le livreur en espèces à la livraison. Seuls certains produits demandent d’abord un acompte, indiqué avant la commande.',
      links: [{ to: '/services/cash-on-delivery', label: 'Paiement à la livraison' }],
    },
    {
      id: 'faq-account',
      q: 'Faut-il un compte ?',
      a: 'Non, vous pouvez commander en invité et suivre la commande avec son numéro et votre téléphone. Un compte garde toutes vos commandes et adresses au même endroit.',
      links: [{ to: '/track-order', label: 'Suivre une commande' }],
    },
    {
      id: 'faq-delivery-time',
      q: 'Combien de temps prend la livraison ?',
      a: 'Les commandes confirmées sont en général préparées sous 1 à 2 jours ouvrés, puis livrées sous 2 à 5 jours ouvrés selon votre ville. Ce sont des estimations.',
      links: [{ to: '/services/home-delivery', label: 'Livraison à domicile' }],
    },
    {
      id: 'faq-fee',
      q: 'Combien coûte la livraison ?',
      a: 'Cela dépend de votre ville. Le montant exact s’affiche au moment de commander, et la livraison est offerte à partir d’un certain montant quand l’offre est active.',
    },
    {
      id: 'faq-cancel',
      q: 'Puis-je modifier ou annuler ma commande ?',
      a: 'Oui, tant qu’elle est En attente : ouvrez-la et utilisez Gérer la commande ou Annuler la commande. Une fois confirmée, contactez-nous avec votre numéro de commande.',
      links: [{ to: '/account/orders', label: 'Voir mes commandes' }],
    },
    {
      id: 'faq-check',
      q: 'Puis-je vérifier le colis avant de payer ?',
      a: 'Oui. Vérifiez que le colis est intact et correspond à votre commande, puis payez. S’il est abîmé ou erroné, vous pouvez le refuser et nous contacter le jour même.',
    },
    {
      id: 'faq-return',
      q: 'Comment retourner un produit ?',
      a: 'Sous 14 jours après la livraison, contactez-nous avec votre numéro de commande avant d’envoyer quoi que ce soit. Le produit doit être non utilisé, complet et dans son emballage d’origine.',
      links: [{ to: '/services/returns', label: 'Retours' }],
    },
    {
      id: 'faq-warranty',
      q: 'Que couvre la garantie ?',
      a: 'Les défauts de fabrication, pendant 6 mois à partir de la livraison, sur les produits éligibles. Les chutes, liquides, mauvaises utilisations et l’usure normale ne sont pas couverts.',
      links: [{ to: '/services/warranty', label: 'Garantie' }],
    },
    {
      id: 'faq-lost-number',
      q: 'J’ai perdu mon numéro de commande. Que faire ?',
      a: 'Si vous avez un compte, il est dans Compte → Commandes. Sinon, écrivez-nous sur WhatsApp avec le nom et le téléphone utilisés pour la commande.',
      links: [{ to: '/contact', label: 'Contacter le support' }],
    },
    {
      id: 'faq-business',
      q: 'Acceptez-vous les commandes professionnelles ou en quantité ?',
      a: 'Oui. Écrivez-nous ce dont vous avez besoin (produits et quantités) et nous préparons un devis.',
      links: [{ to: '/contact', label: 'Nous contacter' }],
    },
  ],
}
