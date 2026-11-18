/* Trainer persistence. IndexedDB (records, key-value, answer log) with an in-memory
   copy for synchronous reads; falls back to localStorage when IndexedDB is unavailable.
   Writes are batched into one transaction per tick and flushed when the page hides.
   Safari may abort a transaction that is still running when the page unloads, so every
   write not yet confirmed by IndexedDB is also kept in a small localStorage journal
   (written synchronously) and replayed on the next start. */
(function () {
  'use strict'
  const V = window.VocabApp
  const NAME = 'ielts-zh-vocab-srs'
  const LS = 'ielts-zh-vocab:srs:'
  const JOURNAL = `${LS}journal`
  const LOG_CAP_LOCAL = 3000

  const recs = new Map()
  const kv = {}
  const dirty = { recs: new Map(), kv: new Set(), log: [] }
  // Unconfirmed writes: key -> { v, n }. n is a write counter, so a transaction only clears
  // entries that were not written again after it started (objects are mutated in place).
  const journal = { recs: new Map(), kv: new Map(), log: [] }
  let seq = 0
  let journalQueued = false
  let idb = null
  let mode = 'memory'
  let timer = 0
  let localLog = []

  const reqP = r => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

  function openIdb() {
    return new Promise((resolve) => {
      let done = false
      const finish = (v) => {
        if (!done) {
          done = true
          resolve(v)
        }
      }
      try {
        const req = indexedDB.open(NAME, 1)
        req.onupgradeneeded = () => {
          const db = req.result
          db.createObjectStore('records', { keyPath: 'k' })
          db.createObjectStore('kv')
          db.createObjectStore('log', { autoIncrement: true })
        }
        req.onsuccess = () => finish(req.result)
        req.onerror = () => finish(null)
        req.onblocked = () => finish(null)
        setTimeout(() => finish(null), 5000)
      }
      catch (e) {
        finish(null)
      }
    })
  }

  async function loadIdb() {
    const tx = idb.transaction(['records', 'kv'], 'readonly')
    // Issue every request before awaiting so the transaction stays alive in Safari.
    const all = reqP(tx.objectStore('records').getAll())
    const keys = reqP(tx.objectStore('kv').getAllKeys())
    const vals = reqP(tx.objectStore('kv').getAll())
    const [r, k, v] = await Promise.all([all, keys, vals])
    for (const rec of r)
      recs.set(rec.k, rec)
    k.forEach((key, i) => { kv[key] = v[i] })
  }

  function writeJournal() {
    journalQueued = false
    try {
      if (!journal.recs.size && !journal.kv.size && !journal.log.length)
        localStorage.removeItem(JOURNAL)
      else
        localStorage.setItem(JOURNAL, JSON.stringify({ recs: [...journal.recs.values()].map(e => e.v), kv: [...journal.kv].map(([key, e]) => [key, e.v === undefined ? null : e.v, e.v === undefined]), log: journal.log }))
    }
    catch (e) {}
  }

  // One synchronous write at the end of the current task, before the page can unload.
  function queueJournal() {
    if (mode !== 'idb' || journalQueued)
      return
    journalQueued = true
    queueMicrotask(writeJournal)
  }

  /** Re-apply writes from a previous page that never reached IndexedDB. */
  function replayJournal() {
    let data
    try {
      data = JSON.parse(localStorage.getItem(JOURNAL) || 'null')
    }
    catch (e) {
      data = null
    }
    if (!data)
      return
    for (const rec of data.recs || []) {
      if (rec && typeof rec.k === 'string')
        V.db.put(rec)
    }
    for (const [key, value, del] of data.kv || [])
      V.db.setKV(key, del ? undefined : value)
    for (const e of data.log || [])
      V.db.log(e)
  }

  function loadLocal() {
    try {
      const r = JSON.parse(localStorage.getItem(`${LS}records`) || '[]')
      for (const rec of r)
        recs.set(rec.k, rec)
      Object.assign(kv, JSON.parse(localStorage.getItem(`${LS}kv`) || '{}'))
      localLog = JSON.parse(localStorage.getItem(`${LS}log`) || '[]')
      return true
    }
    catch (e) {
      return false
    }
  }

  const ready = (async () => {
    if ('indexedDB' in window) {
      idb = await openIdb()
      if (idb) {
        try {
          await loadIdb()
          mode = 'idb'
          idb.onversionchange = () => idb.close()
          replayJournal()
          return
        }
        catch (e) {
          idb = null
        }
      }
    }
    mode = loadLocal() ? 'local' : 'memory'
  })()

  function schedule() {
    if (!timer)
      timer = setTimeout(flush, mode === 'local' ? 800 : 0)
  }

  function flush() {
    clearTimeout(timer)
    timer = 0
    if (!dirty.recs.size && !dirty.kv.size && !dirty.log.length)
      return Promise.resolve()
    const r = [...dirty.recs.values()]
    const k = [...dirty.kv]
    const kvVals = k.map(key => kv[key])
    const rN = r.map(rec => (journal.recs.get(rec.k) || {}).n)
    const kN = k.map(key => (journal.kv.get(key) || {}).n)
    const l = dirty.log.splice(0)
    dirty.recs.clear()
    dirty.kv.clear()
    if (mode === 'idb') {
      const confirm = () => {
        r.forEach((rec, i) => {
          if ((journal.recs.get(rec.k) || {}).n === rN[i])
            journal.recs.delete(rec.k)
        })
        k.forEach((key, i) => {
          if ((journal.kv.get(key) || {}).n === kN[i])
            journal.kv.delete(key)
        })
        journal.log = journal.log.filter(e => !l.includes(e))
        writeJournal()
      }
      return new Promise((resolve) => {
        try {
          const tx = idb.transaction(['records', 'kv', 'log'], 'readwrite')
          const rs = tx.objectStore('records')
          const ks = tx.objectStore('kv')
          const ls = tx.objectStore('log')
          for (const rec of r)
            rec.__del ? rs.delete(rec.k) : rs.put(rec)
          k.forEach((key, i) => (kvVals[i] === undefined ? ks.delete(key) : ks.put(kvVals[i], key)))
          for (const e of l)
            ls.add(e)
          tx.oncomplete = () => {
            confirm()
            resolve()
          }
          tx.onerror = tx.onabort = () => {
            V.toast('学习记录保存失败，请导出备份')
            resolve()
          }
        }
        catch (e) {
          V.toast('学习记录保存失败，请导出备份')
          resolve()
        }
      })
    }
    if (mode === 'local') {
      try {
        localLog = localLog.concat(l).slice(-LOG_CAP_LOCAL)
        localStorage.setItem(`${LS}records`, JSON.stringify([...recs.values()]))
        localStorage.setItem(`${LS}kv`, JSON.stringify(kv))
        localStorage.setItem(`${LS}log`, JSON.stringify(localLog))
      }
      catch (e) {
        V.toast('存储空间不足，学习记录可能未保存')
      }
    }
    return Promise.resolve()
  }

  async function readLog() {
    await flush()
    if (mode === 'idb')
      return reqP(idb.transaction('log', 'readonly').objectStore('log').getAll())
    return localLog.slice()
  }

  async function clearAll() {
    recs.clear()
    for (const key of Object.keys(kv))
      delete kv[key]
    dirty.recs.clear()
    dirty.kv.clear()
    dirty.log.length = 0
    localLog = []
    journal.recs.clear()
    journal.kv.clear()
    journal.log = []
    try {
      localStorage.removeItem(JOURNAL)
    }
    catch (e) {}
    if (mode === 'idb') {
      const tx = idb.transaction(['records', 'kv', 'log'], 'readwrite')
      tx.objectStore('records').clear()
      tx.objectStore('kv').clear()
      tx.objectStore('log').clear()
      await new Promise((resolve) => { tx.oncomplete = tx.onerror = tx.onabort = resolve })
    }
    else if (mode === 'local') {
      for (const key of ['records', 'kv', 'log'])
        localStorage.removeItem(LS + key)
    }
  }

  V.db = {
    ready,
    get mode() { return mode },
    get: k => recs.get(k),
    put(rec) {
      recs.set(rec.k, rec)
      dirty.recs.set(rec.k, rec)
      journal.recs.set(rec.k, { v: rec, n: ++seq })
      queueJournal()
      schedule()
    },
    records: () => recs.values(),
    /** Long-term cards only (keys uid|skill). */
    cards: () => {
      const out = []
      for (const r of recs.values()) {
        if (r.skill)
          out.push(r)
      }
      return out
    },
    getKV: (key, fallback) => (kv[key] === undefined ? fallback : kv[key]),
    setKV(key, value) {
      kv[key] = value
      dirty.kv.add(key)
      journal.kv.set(key, { v: value, n: ++seq })
      queueJournal()
      schedule()
    },
    log(entry) {
      dirty.log.push(entry)
      journal.log.push(entry)
      queueJournal()
      schedule()
    },
    flush,
    readLog,
    clearAll,
    async exportAll() {
      return { records: [...recs.values()], kv: Object.assign({}, kv), log: await readLog() }
    },
    async importAll(data) {
      if (!data || !Array.isArray(data.records) || typeof data.kv !== 'object')
        throw new Error('训练记录格式不正确')
      if (data.records.some(r => !r || typeof r.k !== 'string'))
        throw new Error('训练记录格式不正确')
      await clearAll()
      for (const r of data.records)
        V.db.put(r)
      for (const [key, value] of Object.entries(data.kv))
        V.db.setKV(key, value)
      for (const e of data.log || [])
        dirty.log.push(e)
      await flush()
    },
  }

  // Writes are batched; make sure they land when the app is backgrounded or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden')
      flush()
  })
  window.addEventListener('pagehide', () => flush())
})()
