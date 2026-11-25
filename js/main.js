/* Boot: wait for stored training data, then tabs, hash routing, keyboard-aware layout, offline cache.
   词汇 groups the self-test, word list, wrong book and statistics under one top tab. */
(function () {
  'use strict'
  const V = window.VocabApp
  const VOCAB = ['practice', 'list', 'wrong', 'stats']
  const SKILLS = ['listening', 'reading', 'writing', 'speaking', 'resources']
  const VIEWS = ['train', ...VOCAB, ...SKILLS]
  let active = null

  V.isView = name => active === name
  V.modalOpen = () => !document.getElementById('settings').hidden

  const page = name => (V.pages || {})[name]
  const renderers = {
    train: () => V.trainer.render(),
    practice: () => V.practice.render(),
    list: () => V.views.list(),
    wrong: () => V.views.wrong(),
    stats: () => V.views.stats(),
  }
  for (const name of SKILLS)
    renderers[name] = () => page(name).render()

  const lastVocab = () => {
    const v = V.db.getKV('ui:vocab', 'practice')
    return VOCAB.includes(v) ? v : 'practice'
  }

  function show(name) {
    if (name === 'vocab')
      name = lastVocab()
    if (!VIEWS.includes(name))
      name = 'train'
    const changed = active !== name
    if (changed && active && page(active) && page(active).leave)
      page(active).leave()
    if (changed && 'speechSynthesis' in window)
      window.speechSynthesis.cancel()
    active = name
    const inVocab = VOCAB.includes(name)
    if (inVocab)
      V.db.setKV('ui:vocab', name)
    for (const v of VIEWS)
      document.getElementById(`view-${v}`).hidden = v !== name
    document.querySelector('.subtabs').hidden = !inVocab
    document.querySelectorAll('.tabs a, .subtabs a').forEach((a) => {
      if (a.dataset.view === name || (inVocab && a.dataset.view === 'vocab'))
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
    for (const id of ['wrong-badge', 'vocab-badge']) {
      const badge = document.getElementById(id)
      badge.textContent = n > 999 ? '999+' : String(n)
      badge.hidden = !n
    }
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
    for (const name of SKILLS)
      page(name).mount(document.getElementById(`view-${name}`))
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
