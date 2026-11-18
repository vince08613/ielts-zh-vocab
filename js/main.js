/* Boot: wait for stored training data, then tabs, hash routing, keyboard-aware layout, offline cache. */
(function () {
  'use strict'
  const V = window.VocabApp
  const VIEWS = ['train', 'practice', 'list', 'wrong', 'stats']
  let active = null

  V.isView = name => active === name
  V.modalOpen = () => !document.getElementById('settings').hidden

  const renderers = {
    train: () => V.trainer.render(),
    practice: () => V.practice.render(),
    list: () => V.views.list(),
    wrong: () => V.views.wrong(),
    stats: () => V.views.stats(),
  }

  function show(name) {
    if (!VIEWS.includes(name))
      name = 'train'
    const changed = active !== name
    active = name
    for (const v of VIEWS)
      document.getElementById(`view-${v}`).hidden = v !== name
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.view === name)
        a.setAttribute('aria-current', 'page')
      else
        a.removeAttribute('aria-current')
    })
    renderers[name]()
    if (changed)
      window.scrollTo(0, 0)
  }

  V.go = (name) => {
    if (location.hash !== `#${name}`)
      location.hash = name
    else
      show(name)
  }

  V.rerender = () => {
    renderers[active]()
    V.refreshBadges()
  }

  V.refreshBadges = () => {
    const trainWrong = V.db.cards().filter(c => c.stubborn || c.phase === 'relearn').length
    const n = V.store.reviewIds('e2z').length + V.store.reviewIds('z2e').length + trainWrong
    const badge = document.getElementById('wrong-badge')
    badge.textContent = n > 999 ? '999+' : String(n)
    badge.hidden = !n
  }

  // Compact layout while the on-screen keyboard covers part of the viewport.
  function watchKeyboard() {
    const vv = window.visualViewport
    if (!vv)
      return
    const update = () => {
      document.documentElement.classList.toggle('kb-open', vv.height < window.innerHeight - 120)
    }
    vv.addEventListener('resize', update)
    update()
  }

  function registerWorker() {
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)
    if ('serviceWorker' in navigator && secure)
      navigator.serviceWorker.register('sw.js').catch(() => {})
  }

  // Due queues are recomputed whenever the app comes back; no long-running countdown is trusted.
  function onReturn() {
    if (document.visibilityState !== 'visible')
      return
    V.trainer.onResume()
    V.refreshBadges()
  }

  V.mountIcons()
  V.db.ready.then(() => {
    V.practice.mount(document.getElementById('view-practice'))
    V.views.mount()
    const trainRoot = document.getElementById('view-train')
    V.trainer.mount(trainRoot)
    V.trainer.mountHome(trainRoot)
    window.addEventListener('hashchange', () => show(location.hash.slice(1)))
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('pageshow', onReturn)
    window.addEventListener('focus', onReturn)
    show(location.hash.slice(1))
    V.refreshBadges()
    document.documentElement.classList.add('ready')
    if (V.db.mode !== 'idb')
      V.toast(V.db.mode === 'local' ? '浏览器不支持 IndexedDB，训练记录改存本地存储' : '无法保存训练记录：浏览器存储不可用')
  })
  watchKeyboard()
  registerWorker()
})()
