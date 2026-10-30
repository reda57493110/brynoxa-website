// Runs before the app scripts, so the page a shopper lands on starts loading at once instead of
// one step after another (on a phone over 4G each step is a round trip):
// 1. home: the header photo (same photos and sizes as src/components/home/HeroBackdrop.tsx);
// 2. shop / category / product: that page's code (file names written by the build into
//    #route-chunks, see vite.config.ts);
// 3. the shop data the page asks for first. src/api/client.ts uses these answers instead of
//    asking again (same address, used once, within 20 s); anything else loads as usual.
// A file, not inline: the CSP allows only the site's own scripts.
;(function () {
  var path = location.pathname.replace(/^\/(fr|ar)(?=\/|$)/, '') || '/'
  var plain = !location.search
  var head = document.head

  function link(rel, href, as) {
    var l = document.createElement('link')
    l.rel = rel
    l.href = href
    if (as) l.as = as
    head.appendChild(l)
    return l
  }

  // 1. Home header photo
  if (path === '/') {
    var theme = 'dark'
    try {
      theme = JSON.parse(localStorage.getItem('brynoxa-theme') || '{}').state.theme || 'dark'
    } catch {
      // no saved theme: dark
    }
    var id = theme === 'light' ? 7238759 : 6942359
    var photo = function (w) {
      return (
        'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=' +
        w +
        '&h=' +
        Math.round((w * 1240) / 2200) +
        '&fit=crop'
      )
    }
    ;[
      [1200, '(max-width: 1023px)'],
      [1920, '(min-width: 1024px)'],
    ].forEach(function (p) {
      var l = link('preload', photo(p[0]), 'image')
      l.media = p[1]
      l.setAttribute('fetchpriority', 'high')
    })
  }

  var match = path.match(/^\/(category|product)\/([^/]+)$/)
  var page = path === '/shop' ? 'shop' : match ? match[1] : null
  var slug = match ? match[2] : ''

  // 2. This page's code
  if (page) {
    var chunks = {}
    try {
      chunks = JSON.parse(document.getElementById('route-chunks').textContent)
    } catch {
      // not built (local dev): the app loads it as usual
    }
    ;(chunks[page] || []).forEach(function (file) {
      link('modulepreload', '/' + file)
    })
  }

  // 3. The first data the page needs (filtered views load as usual)
  var urls = []
  if (path === '/') {
    urls = ['settings', 'products?featured=true&inStock=true&limit=12', 'products?featured=true&limit=4', 'products?carousel=true&limit=12', 'categories']
  } else if (page === 'shop' && plain) {
    urls = ['settings', 'products?page=1&limit=12&sort=newest', 'categories', 'brands']
  } else if (page === 'category' && plain) {
    urls = ['categories/' + slug, 'products?category=' + slug + '&limit=24&sort=newest', 'categories']
  } else if (page === 'product') {
    urls = ['products/' + slug]
  }
  if (!urls.length || !window.fetch) return
  var early = (window.__brynoxaEarly = {})
  function get(url) {
    early[url] = {
      at: Date.now(),
      response: fetch(url, { credentials: 'same-origin' })
        .then(function (r) {
          return r.ok ? r.json() : null
        })
        .catch(function () {
          return null
        }),
    }
    return early[url].response
  }
  urls.forEach(function (u) {
    get('/api/v1/' + u)
  })

  // 4. The main photo, as soon as the data that names it arrives (same address, sizes and
  //    srcset as the page builds — src/lib/image.ts sizedImageUrl / imageSrcSet — so the
  //    browser reuses it)
  function sized(url, w) {
    if (url.indexOf('images.unsplash.com') >= 0) {
      try {
        var u = new URL(url)
        u.searchParams.set('w', String(w))
        u.searchParams.set('q', w <= 400 ? '60' : '80')
        u.searchParams.set('auto', 'format')
        return u.toString()
      } catch {
        return url
      }
    }
    return url.indexOf('res.cloudinary.com') >= 0 ? url.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_' + w + '/') : url
  }
  function photo(url, width, widths, sizes) {
    if (!url) return
    var l = link('preload', sized(url, width), 'image')
    if (url.indexOf('res.cloudinary.com') >= 0 || url.indexOf('images.unsplash.com') >= 0) {
      l.setAttribute('imagesrcset', widths.map(function (w) { return sized(url, w) + ' ' + w + 'w' }).join(', '))
      l.setAttribute('imagesizes', sizes)
    }
    l.referrerPolicy = 'no-referrer'
    l.setAttribute('fetchpriority', 'high')
  }
  function primary(p) {
    var imgs = (p && p.images) || []
    for (var i = 0; i < imgs.length; i++) if (imgs[i].isPrimary) return imgs[i].url
    return imgs[0] && imgs[0].url
  }

  // Shop: the product picked for the top of the page (Admin → Settings), then its photo
  // (src/components/layout/StoreHero.tsx)
  if (page === 'shop' && plain) {
    early['/api/v1/settings'].response.then(function (s) {
      var id = s && s.data && s.data.pageHeroProducts && s.data.pageHeroProducts.shop
      if (!id || !/^[a-f0-9]{24}$/i.test(id)) return
      get('/api/v1/products/compare?ids=' + id).then(function (r) {
        var p = r && r.data && r.data[0]
        if (p && p.stock > 0) photo(primary(p), 1280, [640, 960, 1280, 1600], '(min-width: 768px) 60vw, 100vw')
      })
    })
  }
  // Product: its first photo (src/components/product/ImageGallery.tsx)
  if (page === 'product') {
    early['/api/v1/products/' + slug].response.then(function (r) {
      var imgs = (r && r.data && r.data.images) || []
      if (imgs[0]) photo(imgs[0].url, 1200, [480, 768, 1080, 1440], '(min-width: 1024px) 45vw, 100vw')
    })
  }
})()
