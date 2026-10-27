// Home page only: start downloading the header photo right away, before the app scripts run
// (same photo and sizes as src/components/home/HeroBackdrop.tsx). A file, not inline: the CSP
// allows only the site's own scripts.
;(function () {
  if (!/^\/(fr\/?|ar\/?)?$/.test(location.pathname)) return
  var photo = function (w) {
    return (
      'https://images.pexels.com/photos/6942359/pexels-photo-6942359.jpeg?auto=compress&cs=tinysrgb&w=' +
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
    var l = document.createElement('link')
    l.rel = 'preload'
    l.as = 'image'
    l.href = photo(p[0])
    l.media = p[1]
    l.setAttribute('fetchpriority', 'high')
    document.head.appendChild(l)
  })
})()
