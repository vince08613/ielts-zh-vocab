/* Local persistence: progress per word and direction, settings, history, active session. */
(function () {
  'use strict'
  const V = window.VocabApp
  const core = V.core
  const NS = 'ielts-zh-vocab:'
  const DIRS = ['e2z', 'z2e']
  const HISTORY_LIMIT = 200

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key)
      return raw ? JSON.parse(raw) : fallback
    }
    catch (e) {
      return fallback
    }
  }

  let warned = false
  function write(key, value) {
    try {
      if (value == null)
        localStorage.removeItem(NS + key)
      else
        localStorage.setItem(NS + key, JSON.stringify(value))
      return true
    }
    catch (e) {
      if (!warned) {
        warned = true
        V.toast('无法保存学习记录：浏览器存储不可用')
      }
      return false
    }
  }

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
  const validProgress = p => isObj(p) && DIRS.every(d => isObj(p[d]))

  const DEFAULT_SETTINGS = { voice: 'dict', accent: 'en-GB', autoSpeak: true, autoNext: true }
  const DEFAULT_CONFIG = { dir: 'e2z', type: 'choice', chapter: 0, source: 'new', count: 20, order: 'book' }

  function cleanConfig(c) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, isObj(c) ? c : {})
    if (!DIRS.includes(cfg.dir))
      cfg.dir = 'e2z'
    if (!['choice', 'write', 'card'].includes(cfg.type))
      cfg.type = 'choice'
    if (!['all', 'new', 'weak', 'wrong'].includes(cfg.source))
      cfg.source = 'new'
    if (!['book', 'random'].includes(cfg.order))
      cfg.order = 'book'
    cfg.count = [10, 20, 50, 0].includes(cfg.count) ? cfg.count : 20
    cfg.chapter = V.parseChapter(cfg.chapter)
    return cfg
  }

  const savedProgress = read('progress', null)
  const savedSession = read('session', null)

  // Progress is stored by stable word id (chapter:headword); legacy files used row numbers.
  const toId = key => (String(key).includes(':') ? (V.byUid[key] || {}).id : (V.byId[key] ? Number(key) : undefined))
  function fromStorage(p) {
    const out = { e2z: {}, z2e: {} }
    for (const d of DIRS) {
      for (const [key, rec] of Object.entries(p[d])) {
        const id = toId(key)
        if (id !== undefined)
          out[d][id] = rec
      }
    }
    return out
  }
  function toStorage(p) {
    const out = { e2z: {}, z2e: {} }
    for (const d of DIRS) {
      for (const [id, rec] of Object.entries(p[d])) {
        if (V.byId[id])
          out[d][V.byId[id].uid] = rec
      }
    }
    return out
  }
  const sessionOk = s => isObj(s) && Array.isArray(s.queue) && Array.isArray(s.uids)
    && s.queue.length === s.uids.length && s.queue.every((id, i) => V.byId[id] && V.byId[id].uid === s.uids[i])

  const store = {
    progress: validProgress(savedProgress) ? fromStorage(savedProgress) : { e2z: {}, z2e: {} },
    settings: Object.assign({}, DEFAULT_SETTINGS, read('settings', {})),
    config: cleanConfig(read('config', null)),
    history: Array.isArray(read('history', null)) ? read('history', []) : [],
    session: sessionOk(savedSession) ? savedSession : null,
    list: Object.assign({ chapter: 0, mask: 'none' }, read('list', {})),
  }

  const now = () => Math.floor(Date.now() / 1000)

  store.saveSettings = () => write('settings', store.settings)
  store.saveConfig = () => write('config', store.config)
  store.saveSession = () => write('session', store.session ? Object.assign({}, store.session, { uids: store.session.queue.map(id => V.byId[id].uid) }) : null)
  store.saveList = () => write('list', store.list)
  const saveProgress = () => write('progress', toStorage(store.progress))

  /** Record one answer; returns the previous record so an override can restore it. */
  store.record = (dir, id, result) => {
    const prev = store.progress[dir][id] || null
    store.progress[dir][id] = core.applyResult(prev, result, now())
    saveProgress()
    return prev ? prev.slice() : null
  }

  store.restore = (dir, id, prev) => {
    if (prev)
      store.progress[dir][id] = prev.slice()
    else
      delete store.progress[dir][id]
    saveProgress()
  }

  store.status = (dir, id) => core.statusOf(store.progress[dir][id])

  store.reviewIds = (dir) => {
    const p = store.progress[dir]
    return Object.keys(p)
      .filter(id => V.byId[id] && core.statusOf(p[id]) === 'review')
      .sort((a, b) => (p[b][1] - p[a][1]) || (p[b][3] - p[a][3]))
      .map(Number)
  }

  /** Remove words from the wrong book without claiming they are mastered. */
  store.dismiss = (dir, ids) => {
    for (const id of ids) {
      const rec = store.progress[dir][id]
      if (!rec)
        continue
      rec[1] = 0
      rec[4] = 'r'
    }
    saveProgress()
  }

  store.addHistory = (entry) => {
    store.history.unshift(entry)
    if (store.history.length > HISTORY_LIMIT)
      store.history.length = HISTORY_LIMIT
    write('history', store.history)
  }

  store.exportData = () => ({
    app: 'ielts-zh-vocab',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: toStorage(store.progress),
    history: store.history,
    settings: store.settings,
  })

  store.importData = (obj) => {
    if (!isObj(obj) || obj.app !== 'ielts-zh-vocab' || !validProgress(obj.progress))
      throw new Error('不是本应用导出的学习记录文件')
    for (const d of DIRS) {
      for (const [key, rec] of Object.entries(obj.progress[d])) {
        if (toId(key) === undefined || !Array.isArray(rec) || rec.length !== 5)
          throw new Error(`记录格式不正确（单词 ${key}）`)
      }
    }
    store.progress = fromStorage(obj.progress)
    store.history = Array.isArray(obj.history) ? obj.history.slice(0, HISTORY_LIMIT) : []
    if (isObj(obj.settings))
      store.settings = Object.assign({}, DEFAULT_SETTINGS, obj.settings)
    saveProgress()
    write('history', store.history)
    store.saveSettings()
  }

  store.resetAll = () => {
    store.progress = { e2z: {}, z2e: {} }
    store.history = []
    store.session = null
    saveProgress()
    write('history', store.history)
    store.saveSession()
  }

  V.store = store
})()
