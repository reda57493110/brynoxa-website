import type { HelpGuide } from './types'

/** English Help Center. Same ids in fr.ts and ar.ts. Policies are summarised; the linked pages are the reference. */
export const en: HelpGuide = {
  sections: [
    {
      id: 'getting-started',
      icon: 'search',
      title: 'Getting started',
      description: 'Find PCs, laptops, parts and accessories in a few taps.',
      topics: [
        {
          id: 'browse',
          title: 'Browsing the shop',
          summary:
            'Open Shop from the menu to see every product. On the home page, the categories take you straight to laptops, gaming PCs, components, monitors and accessories.',
          points: [
            'Each card shows the photo, price in DH, any discount and whether the product is in stock.',
            'Tap a card to open the full product page.',
            'On phones, choose one or two products per row with the buttons above the list.',
          ],
          keywords: 'catalog products home categories menu',
          links: [{ to: '/shop', label: 'Open the shop' }],
        },
        {
          id: 'search',
          title: 'Searching for a product',
          summary:
            'Use the search bar at the top of every page (the magnifying glass on phones). Suggestions appear as you type: products, and the categories that match.',
          steps: [
            'Type a product name, a brand (HP, ASUS, Lenovo…) or a part (RTX, i7, 16 GB…).',
            'Pick a suggestion to open it, or press Enter to see all the results.',
            'Refine the results with the filters, like in the shop.',
          ],
          points: ['On a computer, press the / key to jump to the search bar.'],
          keywords: 'find look for search bar keyword brand',
          links: [{ to: '/search', label: 'Search the shop' }],
        },
        {
          id: 'filters',
          title: 'Categories, filters and sorting',
          summary: 'Narrow a long list down to the products that fit your needs and budget.',
          points: [
            'Category and brand: keep only the products you are interested in.',
            'Price (DH): choose a ready-made range or type your own minimum and maximum.',
            'In stock only: hide products that are currently unavailable.',
            'Sort: newest, price low to high, price high to low, or most popular.',
            'On phones, open the Filters button, then tap “Show … products”. “Clear filters” starts again.',
          ],
          keywords: 'filter brand price range budget sort cheapest stock',
          links: [{ to: '/shop', label: 'Browse with filters' }],
        },
        {
          id: 'compare',
          title: 'Comparing products',
          summary:
            'Not sure between two laptops? Add up to 4 products to Compare and see them side by side, point by point.',
          steps: [
            'Tap the compare button on a product card or product page.',
            'Open Compare from the top bar (the layers icon) or the menu.',
            'Turn on “Show only differences” to see what really changes. The best value on each row is highlighted, and “Our pick” shows the product that wins the most points.',
          ],
          keywords: 'compare side by side versus vs difference',
          links: [{ to: '/compare', label: 'Open Compare' }],
        },
      ],
    },
    {
      id: 'product-pages',
      icon: 'monitor',
      title: 'Understanding product pages',
      description: 'Photos, specifications, stock, condition and matching accessories.',
      topics: [
        {
          id: 'product-details',
          title: 'Photos, description and specifications',
          summary: 'Everything about a product is on its page.',
          points: [
            'Swipe or click through the photos. Photos are as close to the product as possible, but colour and packaging may differ slightly.',
            'The description explains what the product is for.',
            'Specifications list the key points first. Open “All specifications” for the full list.',
            'The price is in Moroccan dirhams (DH), taxes included. A crossed-out price means the product is on discount.',
            '“More options available” means the product comes in other versions (for example memory or storage). Pick the one you want before adding it to the cart.',
          ],
          keywords: 'specs specification photo image description price discount variant version option',
        },
        {
          id: 'availability',
          title: 'Stock and availability',
          summary: 'The product page and cards show whether you can order now.',
          points: [
            'In stock: you can order it now.',
            'Only a few left: the number shown is what remains.',
            'Out of stock: it cannot be ordered for now. Ask us on WhatsApp if you want to know when it comes back.',
            'Stock is checked again when you place the order. If it changed, checkout tells you to adjust the quantity.',
          ],
          keywords: 'stock available availability out of stock sold out left',
          links: [{ to: '/contact', label: 'Ask about a product' }],
        },
        {
          id: 'condition',
          title: 'New, refurbished or used',
          summary:
            'Products are new unless the page says otherwise. Refurbished and used products are marked as such and show a notice on the product page, so you always know what you are buying.',
          keywords: 'condition new refurbished used second hand occasion',
        },
        {
          id: 'complete-setup',
          title: 'Complete your setup',
          summary:
            'Under many products, “Complete your setup” suggests accessories that go well with it, such as a mouse, a headset or a bag for a laptop.',
          steps: [
            'Scroll to “Complete your setup” on the product page.',
            'Tap a suggestion to see its details, or use Add to put it straight in your cart.',
            'Everything ends up in the same cart and the same cash-on-delivery order.',
          ],
          keywords: 'accessories compatible setup bundle mouse keyboard headset recommended',
        },
        {
          id: 'add-to-cart',
          title: 'Adding to the cart or buying now',
          summary: 'Add to cart keeps you shopping. Buy now takes you straight to checkout with the product.',
          points: [
            'Similar products at the bottom of the page help you compare before you choose.',
            'Have a question first? Tap WhatsApp under the buttons: your message about this product is ready to send.',
          ],
          keywords: 'add to cart buy now basket',
        },
      ],
    },
    {
      id: 'account',
      icon: 'user',
      title: 'Your account',
      description: 'Sign up, keep your details and addresses, and find your orders.',
      topics: [
        {
          id: 'register',
          title: 'Creating an account and signing in',
          summary:
            'An account is optional: you can order as a guest. With an account, your orders are in one place and your details are filled in for you next time.',
          steps: [
            'Choose Sign in at the top of the page, then “Create an account”.',
            'Enter your name, email and a password.',
            'You can also tick “Create an account” at checkout when you order as a guest.',
          ],
          points: [
            'If you already ordered as a guest with the same email, we send a link to that email to confirm it is yours.',
          ],
          keywords: 'register sign up login sign in create account guest',
          links: [
            { to: '/register', label: 'Create an account' },
            { to: '/login', label: 'Sign in' },
          ],
        },
        {
          id: 'profile',
          title: 'Updating your details and addresses',
          summary: 'Open Account → Settings to change your name and phone number and manage your delivery addresses.',
          points: [
            'Addresses: add one with a label (for example Home or Work), the recipient name, address, city and phone. Remove the ones you no longer use.',
            'At checkout, choose a saved address instead of typing it again.',
            'Your email is your sign-in and cannot be changed from the page. Contact us if it needs to change.',
            'Change your password in the same page.',
          ],
          keywords: 'profile settings address phone name edit update change password',
          links: [{ to: '/account/settings', label: 'Open settings' }],
        },
        {
          id: 'account-orders',
          title: 'Orders and notifications',
          summary:
            'Account → Orders lists all your orders with their status. Account → Notifications keeps the updates about your orders.',
          points: [
            'You can also allow notifications on your phone or computer to be told when your order is confirmed, shipped and delivered.',
          ],
          keywords: 'order history my orders notifications alerts push',
          links: [
            { to: '/account/orders', label: 'View my orders' },
            { to: '/account/notifications', label: 'Notifications' },
          ],
        },
        {
          id: 'password',
          title: 'Forgot your password?',
          summary: 'Choose “Forgot password” on the sign-in page and enter your email to receive a link to choose a new one.',
          points: [
            'The link works for a limited time. If it expired, ask for a new one.',
            'No email after a few minutes? Check your spam folder, or contact us on WhatsApp and we will help you get back in.',
          ],
          keywords: 'forgot password reset recover lost access cannot sign in',
          links: [{ to: '/forgot-password', label: 'Reset my password' }],
        },
      ],
    },
    {
      id: 'checkout',
      icon: 'cart',
      title: 'Cart and checkout',
      description: 'From the cart to a placed order, step by step.',
      topics: [
        {
          id: 'cart',
          title: 'Managing your cart',
          summary: 'Open the cart from the bag icon at the top of the page.',
          points: [
            'Change quantities with + and −, or remove a product.',
            'The summary shows the subtotal and the delivery fee from the lowest rate. The exact fee depends on your city and is shown at checkout.',
            'When free delivery applies above a certain amount, the cart tells you how much is left to reach it.',
            'Your cart is kept on this device until you order.',
          ],
          keywords: 'cart basket quantity remove update subtotal free shipping',
          links: [{ to: '/cart', label: 'Open my cart' }],
        },
        {
          id: 'place-order',
          title: 'Placing an order',
          summary: 'Checkout takes about a minute. No card is needed.',
          steps: [
            'In the cart, choose Checkout.',
            'Enter your full name, phone number, address and city (signed in? pick a saved address). Guests also enter an email.',
            'Optional: add a coupon code and a note for the delivery (for example the best time to call).',
            'Check the order summary: products, discount, delivery fee for your city and the total to pay.',
            'Choose “Place COD order”.',
          ],
          points: [
            'Use a phone number you answer: we call or message you to confirm the order before shipping it.',
            'Placing an order means you accept the Terms of Sale.',
          ],
          keywords: 'checkout order buy place order address phone city coupon promo code note',
          links: [
            { to: '/checkout', label: 'Go to checkout' },
            { to: '/terms#orders', label: 'Terms: placing an order' },
          ],
        },
        {
          id: 'order-placed',
          title: 'How you know it worked',
          summary:
            'After you place the order, a confirmation page shows your order number (it starts with BRX-) and the amount to pay on delivery.',
          points: [
            'Save the order number: you need it to track the order, ask for help, and for the warranty.',
            'Signed in? The order also appears in Account → Orders.',
            'We then contact you to confirm it before packing.',
          ],
          keywords: 'confirmation order number success placed BRX',
        },
        {
          id: 'guest-checkout',
          title: 'Ordering without an account',
          summary:
            'You can order as a guest with your name, phone, address and email. Track the order later with its number and the delivery phone number.',
          points: ['Want an account? Tick “Create an account” at checkout and choose a password.'],
          keywords: 'guest without account no account',
          links: [{ to: '/track-order', label: 'Track a guest order' }],
        },
      ],
    },
    {
      id: 'orders',
      icon: 'package',
      title: 'Orders and tracking',
      description: 'Follow your order, understand its status and change it while you still can.',
      topics: [
        {
          id: 'track-order',
          title: 'Tracking your order',
          summary: 'Signed in, open Account → Orders. Without an account, use Track order with your order number and the phone used for delivery.',
          steps: [
            'Open Track order (in the footer of every page).',
            'Enter the order number (BRX-…) and the delivery phone number.',
            'Choose “Find order” to see its status and history.',
          ],
          keywords: 'track tracking where is my order status follow',
          links: [
            { to: '/track-order', label: 'Track an order' },
            { to: '/account/orders', label: 'View my orders' },
          ],
        },
        {
          id: 'statuses',
          title: 'What each status means',
          summary: 'The status tells you where your order is.',
          points: [
            'Pending: we received your order and will contact you to confirm it.',
            'Awaiting your answer: we tried to reach you to confirm. Answer our call or message us, otherwise the order cannot go further.',
            'Confirmed: your order is confirmed and being prepared.',
            'Shipped: the courier has your package.',
            'Delivery attempt failed: the courier could not deliver it. We will contact you to try again.',
            'Delivery rescheduled: a new delivery date was agreed. It is shown on your order.',
            'Delivered: you received your order. The warranty starts on this date.',
            'Return requested / return in transit / returned: your return is in progress or done. “Partially returned” means only some items came back.',
            'Cancelled: the order was cancelled and nothing is due.',
          ],
          keywords: 'status pending confirmed shipped delivered cancelled failed rescheduled no answer returned meaning',
        },
        {
          id: 'change-order',
          title: 'Changing or cancelling an order',
          summary: 'While an order is still Pending, you can change it or cancel it yourself from its page.',
          points: [
            'Manage order: add products, remove them or change quantities, then save to update the total.',
            'Cancel order: stops the order. Nothing is due on delivery.',
            'Already confirmed? Contact us with your order number and we will see what can be done.',
            'Need to change the address or phone? Message us with your order number as soon as possible.',
          ],
          keywords: 'cancel change edit modify order address quantity',
          links: [
            { to: '/account/orders', label: 'View my orders' },
            { to: '/contact', label: 'Contact support' },
          ],
        },
        {
          id: 'delays',
          title: 'Delayed order or failed delivery',
          summary:
            'Confirmed orders are usually packed within 1–2 business days and delivered within 2–5 business days depending on your city. These are estimates.',
          points: [
            'Check the status first: a rescheduled delivery shows its new date.',
            'If the courier could not reach you, the status becomes “Delivery attempt failed”. Keep your phone nearby: we contact you to plan a new attempt.',
            'Longer than expected? Send us your order number on WhatsApp and we will check with the courier.',
          ],
          keywords: 'late delay delayed not arrived failed delivery courier missed',
          links: [
            { to: '/services/home-delivery', label: 'Home delivery' },
            { to: '/contact', label: 'Contact support' },
          ],
        },
      ],
    },
    {
      id: 'payments',
      icon: 'banknote',
      title: 'Payment',
      description: 'Cash on delivery, and the deposit some orders need.',
      topics: [
        {
          id: 'cod',
          title: 'Cash on delivery',
          summary: 'You pay the courier in cash when the package arrives. No card is needed and nothing is charged online.',
          steps: [
            'Place your order: the total to pay on delivery is shown before you confirm.',
            'When the courier arrives, check that the package is intact and is what you ordered.',
            'Pay the amount due in cash.',
            'If the package is damaged or wrong, you can refuse it. Contact us the same day.',
          ],
          keywords: 'cash on delivery cod pay courier no card payment method',
          links: [
            { to: '/services/cash-on-delivery', label: 'Cash on delivery' },
            { to: '/terms#payment', label: 'Terms: payment' },
          ],
        },
        {
          id: 'deposit',
          title: 'Orders that need a deposit',
          summary:
            'Most orders are paid entirely on delivery. Some products need a deposit before we confirm the order. The product page says so, with the amount.',
          points: [
            'How it is calculated: each product sets its own deposit, either a fixed amount per unit or a percentage of its price. The deposit of an order is the total for its products, never more than the order itself.',
            'Before you order: checkout shows the deposit and the amount left to pay on delivery.',
            'After you order: your order page shows how to pay (the payment options available, such as a transfer), then use “Send proof of payment” with the reference or a photo of the receipt.',
            'We check the payment, then confirm the order.',
            'On delivery, you pay only the rest: the total minus the deposit.',
          ],
          keywords: 'deposit advance down payment acompte transfer proof receipt partial',
          links: [{ to: '/account/orders', label: 'Pay a deposit from my orders' }],
        },
        {
          id: 'coupons',
          title: 'Coupons and discounts',
          summary:
            'Have a coupon code? Enter it in “Coupon & note” at checkout and choose Apply. The discount appears in the summary before you place the order.',
          keywords: 'coupon promo code discount voucher reduction',
        },
      ],
    },
    {
      id: 'delivery',
      icon: 'truck',
      title: 'Shipping and home delivery',
      description: 'Where we deliver, the fees and what happens after shipping.',
      topics: [
        {
          id: 'delivery-info',
          title: 'Where we deliver and the fees',
          summary: 'We deliver to your door across Morocco only, to the address you give at checkout.',
          points: [
            'The delivery fee depends on your city and appears at checkout as soon as you pick it.',
            'Free delivery applies above a certain amount when the offer is active: the cart shows it.',
            'Make sure the address and phone number are complete and correct, and that someone can receive the package.',
          ],
          keywords: 'shipping delivery fee cost price city morocco free shipping',
          links: [
            { to: '/services/home-delivery', label: 'Home delivery' },
            { to: '/terms#delivery', label: 'Terms: delivery' },
          ],
        },
        {
          id: 'after-shipping',
          title: 'After your order ships',
          summary:
            'The status changes to Shipped and the courier brings the package to the address you gave. Keep your phone nearby so the courier can reach you.',
          points: [
            'Allowed notifications? You are told when the order ships and when it is delivered.',
            'Check the package before paying. You can refuse a damaged or wrong package.',
          ],
          keywords: 'shipped courier on the way delivery day',
        },
        {
          id: 'not-available',
          title: 'Not home, or a problem with the address?',
          summary: 'Tell us as early as possible so we can arrange it with the courier.',
          points: [
            'Not available on the delivery day: message us with your order number and a better day or time, or ask someone to receive it for you.',
            'Wrong or incomplete address: send the correct address on WhatsApp with your order number.',
            'After a failed attempt, answer our call or message so we can plan a new delivery.',
          ],
          keywords: 'not home absent away wrong address change address unavailable',
          links: [{ to: '/contact', label: 'Contact support' }],
        },
      ],
    },
    {
      id: 'returns',
      icon: 'shield',
      title: 'Returns, refunds and warranty',
      description: '14-day returns and a 6-month warranty. The Terms of Sale are the reference.',
      topics: [
        {
          id: 'return-policy',
          title: 'Return policy',
          summary: 'You have 14 days from delivery to return a product, as long as it is unused, complete and in its original packaging with all accessories.',
          points: [
            'Products damaged by misuse, or with missing parts, cannot be returned.',
            'Defective or wrong product: the pickup is free. Changed your mind: a courier fee may apply.',
            'A swap for another model is possible if it is in stock: you pay or receive the price difference.',
          ],
          keywords: 'return policy 14 days send back changed my mind exchange swap conditions',
          links: [
            { to: '/services/returns', label: 'Returns' },
            { to: '/terms#returns', label: 'Terms: returns and refunds' },
          ],
        },
        {
          id: 'request-return',
          title: 'Requesting a return',
          summary: 'Contact us first. Do not send anything back before we confirm.',
          steps: [
            'Message us on WhatsApp (topic “Return”) or with the contact form, with your order number and the reason.',
            'Wait for our confirmation: we tell you how the pickup works.',
            'Give the courier the product in its original packaging, complete.',
            'We inspect it when it arrives, then exchange it or refund you.',
          ],
          keywords: 'request return how to return start return send back',
          links: [{ to: '/contact', label: 'Start a return' }],
        },
        {
          id: 'refunds',
          title: 'Refunds',
          summary:
            'After we receive and inspect the returned product, we refund you by bank transfer or store credit, usually within 3–7 business days.',
          points: ['If the product does not meet the return conditions, we contact you to explain before doing anything.'],
          keywords: 'refund money back reimbursement store credit transfer',
          links: [{ to: '/terms#returns', label: 'Terms: returns and refunds' }],
        },
        {
          id: 'warranty',
          title: 'Warranty',
          summary:
            'Eligible products have a 6-month Brynoxa warranty from the delivery date, covering manufacturing defects. Your order number is your proof of purchase.',
          points: [
            'Not covered: drops, liquid damage, misuse, normal wear, and repairs done outside Brynoxa.',
            'This warranty does not remove your legal rights regarding hidden defects.',
          ],
          keywords: 'warranty guarantee 6 months defect broken coverage',
          links: [
            { to: '/services/warranty', label: 'Warranty' },
            { to: '/terms#warranty', label: 'Terms: warranty' },
          ],
        },
        {
          id: 'warranty-claim',
          title: 'Asking for warranty support',
          summary: 'A product stopped working or has a defect? Here is what to do.',
          steps: [
            'Message us on WhatsApp (topic “Warranty”) with your order number.',
            'Add a photo or a short video showing the problem.',
            'We confirm whether it is covered and arrange the pickup or drop-off.',
            'After diagnosis, we repair it, replace it or credit you.',
          ],
          keywords: 'warranty claim broken defective not working faulty support',
          links: [{ to: '/contact', label: 'Contact support' }],
        },
      ],
    },
    {
      id: 'repair',
      icon: 'wrench',
      title: 'Repair and technical help',
      description: 'What to do when a product has a problem.',
      topics: [
        {
          id: 'repair-service',
          title: 'Repair service',
          summary:
            'If a product fails under warranty, we diagnose it, then repair or replace it. Out of warranty, a repair can be quoted separately.',
          steps: [
            'Send us a short video of the problem with your order number.',
            'After we approve the request, we arrange the pickup.',
            'We tell you the result of the diagnosis and what we will do.',
          ],
          points: [
            'Back up your data before sending a device: we are not responsible for data loss.',
            'Do not open the product yourself: it can void the warranty.',
          ],
          keywords: 'repair fix technician diagnosis rma broken out of warranty',
          links: [{ to: '/services/repair', label: 'Repair service' }],
        },
        {
          id: 'prepare',
          title: 'What to have ready when you contact us',
          summary: 'These details help us answer you faster.',
          points: [
            'Your order number (BRX-…).',
            'The product name, and a photo or short video of the problem.',
            'What you already tried (another cable, another socket, a restart).',
            'For product advice: your budget and what you will use it for.',
          ],
          keywords: 'information details prepare order number video photo',
        },
        {
          id: 'product-issue',
          title: 'A product does not work as expected',
          summary: 'Start with the simple checks, then contact us.',
          steps: [
            'Check the cables and the power, and restart the device.',
            'Package damaged or wrong product on delivery? Refuse it if you can and contact us the same day.',
            'Problem after delivery? Message us on WhatsApp with your order number and a video: we tell you if it is a return, a warranty repair or a setting to change.',
          ],
          keywords: 'problem issue not working dead does not turn on damaged help',
          links: [{ to: '/contact', label: 'Contact support' }],
        },
      ],
    },
    {
      id: 'support',
      icon: 'chat',
      title: 'Contact support',
      description: 'Real people answer by WhatsApp, phone and email.',
      topics: [
        {
          id: 'contact-channels',
          title: 'How to reach us',
          summary:
            'WhatsApp is the fastest. You can also call us, email us, or use the form on the Contact page. We usually reply the same business day.',
          points: [
            'Hours: Monday to Friday 9:00–18:00, Saturday 10:00–16:00, closed on Sunday.',
            'On the Contact page, choose a WhatsApp topic (my order, help me choose, warranty, return…): your message is written for you.',
            'There is no walk-in shop: we deliver across Morocco.',
          ],
          keywords: 'contact whatsapp phone email call support help hours',
          links: [
            { to: '/contact', label: 'Contact support' },
            { to: '/services/live-support', label: 'Live support' },
          ],
        },
      ],
    },
  ],
  faqs: [
    {
      id: 'faq-card',
      q: 'Do I need a bank card to order?',
      a: 'No. You pay the courier in cash on delivery. Only some products need a deposit first, and that is shown before you order.',
      links: [{ to: '/services/cash-on-delivery', label: 'Cash on delivery' }],
    },
    {
      id: 'faq-account',
      q: 'Do I need an account?',
      a: 'No, you can order as a guest and track the order with its number and your phone. An account keeps all your orders and addresses in one place.',
      links: [{ to: '/track-order', label: 'Track an order' }],
    },
    {
      id: 'faq-delivery-time',
      q: 'How long does delivery take?',
      a: 'Confirmed orders are usually packed within 1–2 business days, then delivered within 2–5 business days depending on your city. These are estimates.',
      links: [{ to: '/services/home-delivery', label: 'Home delivery' }],
    },
    {
      id: 'faq-fee',
      q: 'How much is delivery?',
      a: 'It depends on your city. The exact fee is shown at checkout before you place the order, and delivery is free above a certain amount when that offer is active.',
    },
    {
      id: 'faq-cancel',
      q: 'Can I change or cancel my order?',
      a: 'Yes, while it is still Pending: open it and use Manage order or Cancel order. Once it is confirmed, contact us with your order number.',
      links: [{ to: '/account/orders', label: 'View my orders' }],
    },
    {
      id: 'faq-check',
      q: 'Can I check the package before paying?',
      a: 'Yes. Check that the package is intact and is what you ordered, then pay. If it is damaged or wrong, you can refuse it and contact us the same day.',
    },
    {
      id: 'faq-return',
      q: 'How do I return a product?',
      a: 'Within 14 days of delivery, contact us with your order number before sending anything. The product must be unused, complete and in its original packaging.',
      links: [{ to: '/services/returns', label: 'Returns' }],
    },
    {
      id: 'faq-warranty',
      q: 'What does the warranty cover?',
      a: 'Manufacturing defects, for 6 months from delivery on eligible products. Drops, liquid damage, misuse and normal wear are not covered.',
      links: [{ to: '/services/warranty', label: 'Warranty' }],
    },
    {
      id: 'faq-lost-number',
      q: 'I lost my order number. What do I do?',
      a: 'If you have an account, it is in Account → Orders. Otherwise, message us on WhatsApp with the name and phone used for the order.',
      links: [{ to: '/contact', label: 'Contact support' }],
    },
    {
      id: 'faq-business',
      q: 'Do you take business or bulk orders?',
      a: 'Yes. Write to us with what you need (products and quantities) and we prepare a quote.',
      links: [{ to: '/contact', label: 'Contact us' }],
    },
  ],
}
