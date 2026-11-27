/* Private reading bank storage. The bank (tools/build-bank.mjs) is for personal use only, so it
   is never part of the published site: it is loaded from the local server (/bank/) or from a
   file the learner picks, and kept in its own IndexedDB database (not in the progress export).
   bankMark is a pure function, also used by node tests. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).bankStore = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'
  const NAME = 'ielts-reading-bank'
  const URL = 'bank/ielts-reading-bank.json'
  let dbP = null
  let index = null
  const cache = new Map()

  const req = r => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  function open() {
    if (!dbP) {
      dbP = new Promise((resolve) => {
        try {
          const r = indexedDB.open(NAME, 1)
          r.onupgradeneeded = () => {
            r.result.createObjectStore('meta')
            r.result.createObjectStore('exams', { keyPath: 'id' })
          }
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => resolve(null)
          r.onblocked = () => resolve(null)
        }
        catch (e) {
          resolve(null)
        }
      })
    }
    return dbP
  }

  async function loadIndex() {
    if (index)
      return index
    const db = await open()
    if (!db)
      return null
    index = (await req(db.transaction('meta').objectStore('meta').get('index'))) || null
    return index
  }

  async function getExam(id) {
    if (cache.has(id))
      return cache.get(id)
    const db = await open()
    const e = db ? await req(db.transaction('exams').objectStore('exams').get(id)) : null
    if (e)
      cache.set(id, e)
    return e || null
  }

  const listEntry = e => ({ id: e.id, en: e.en, zh: e.zh, cat: e.cat, freq: e.freq, n: e.order.length, marks: e.order.length + (e.multi || []).reduce((s, m) => s + Math.max(0, m.marks - m.qs.split(',').length), 0), partial: !!e.partial })

  /* An imported file is untrusted: keep only the tags, attributes and classes the bank builder
     emits, and only inline raster images. Runs in an inert <template>, so nothing executes. */
  const TAGS = new Set('h1 h2 h3 h4 h5 h6 p div span strong em b i u s small sub sup br hr ul ol li dl dt dd table thead tbody tfoot tr th td caption col colgroup label input select option img a blockquote figure figcaption'.split(' '))
  const DROP = new Set('script style iframe frame frameset object embed link meta base form button textarea template noscript svg math video audio source canvas'.split(' '))
  const ATTRS = new Set(['class', 'data-q', 'data-i', 'data-qs', 'value', 'name', 'autocomplete', 'autocapitalize', 'autocorrect', 'spellcheck', 'colspan', 'rowspan', 'alt', 'type', 'src', 'lang', 'title'])
  function cleanHtml(html) {
    if (typeof document === 'undefined')
      return String(html || '')
    const t = document.createElement('template')
    t.innerHTML = String(html || '')
    t.content.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase()
      if (DROP.has(tag))
        return el.remove()
      if (!TAGS.has(tag))
        return el.replaceWith(...el.childNodes)
      for (const a of [...el.attributes]) {
        const n = a.name.toLowerCase()
        const v = a.value
        let ok = ATTRS.has(n)
        if (n === 'class') {
          const keep = v.split(/\s+/).filter(c => /^(x|bk)-[\w-]+$/.test(c)).join(' ')
          if (keep)
            el.setAttribute('class', keep)
          ok = !!keep
        }
        else if (n === 'src') {
          ok = tag === 'img' && /^data:image\/(png|jpe?g|gif|webp|avif);base64,[\w+/=\s]+$/i.test(v)
        }
        else if (n === 'type') {
          ok = tag === 'input' ? /^(text|radio|checkbox)$/i.test(v) : tag === 'ol' && /^[1aAiI]$/.test(v)
        }
        else if (n === 'name' || n === 'value') {
          ok = tag === 'input' || tag === 'select' || tag === 'option'
        }
        if (!ok)
          el.removeAttribute(a.name)
      }
    })
    return t.innerHTML
  }

  // Check the shape of one exam and normalise the fields that end up in markup.
  function cleanExam(e) {
    if (!e || typeof e.id !== 'string' || !/^[\w.-]{1,80}$/.test(e.id) || !Array.isArray(e.order) || !Array.isArray(e.groups) || !e.ans || typeof e.ans !== 'object')
      throw new Error('题库文件格式不对，请用 tools/build-bank.mjs 重新生成')
    const str = v => (typeof v === 'string' ? v : '')
    return {
      id: e.id,
      en: str(e.en),
      zh: str(e.zh),
      cat: /^P[123]$/.test(e.cat) ? e.cat : 'P1',
      freq: /^(high|medium|low)$/.test(e.freq) ? e.freq : 'low',
      passage: cleanHtml(e.passage),
      groups: e.groups.map(g => ({ kind: str(g && g.kind), qids: Array.isArray(g && g.qids) ? g.qids.map(String) : [], html: cleanHtml(g && g.html) })),
      ans: e.ans,
      multi: Array.isArray(e.multi) ? e.multi.filter(m => m && typeof m.qs === 'string' && Array.isArray(m.letters)).map(m => ({ qs: m.qs, letters: m.letters.map(String), marks: Number(m.marks) || m.letters.length })) : [],
      num: e.num && typeof e.num === 'object' ? e.num : {},
      order: e.order.map(String),
      xp: e.xp && typeof e.xp === 'object' ? e.xp : {},
      notes: Array.isArray(e.notes) ? e.notes.filter(n => Array.isArray(n)).map(n => [str(n[0]), str(n[1])]) : [],
      noteType: str(e.noteType),
      partial: !!e.partial,
    }
  }

  /** Store a bundle object. Throws on a file that is not a bank. */
  async function importBundle(b) {
    if (!b || b.format !== 'ielts-reading-bank' || !Array.isArray(b.exams))
      throw new Error('不是题库文件（需要 tools/build-bank.mjs 生成的 ielts-reading-bank.json）')
    const exams = b.exams.map(cleanExam)
    const db = await open()
    if (!db)
      throw new Error('浏览器存储不可用')
    const idx = { version: b.version, built: String(b.built || ''), source: String(b.source || ''), count: exams.length, questions: exams.reduce((s, e) => s + e.order.length, 0), list: exams.map(listEntry) }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['meta', 'exams'], 'readwrite')
      tx.objectStore('exams').clear()
      for (const e of exams)
        tx.objectStore('exams').put(e)
      tx.objectStore('meta').put(idx, 'index')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error || new Error('存储空间不足'))
    })
    index = idx
    cache.clear()
    return idx
  }

  /** Load or refresh from the local server. Resolves to 'loaded' | 'current' | 'none'. */
  async function fromServer() {
    let res
    try {
      res = await fetch(URL, { cache: 'no-cache' })
    }
    catch (e) {
      return 'none'
    }
    if (!res.ok || !/json/.test(res.headers.get('content-type') || ''))
      return 'none'
    const b = await res.json()
    const cur = await loadIndex()
    if (cur && cur.built === b.built)
      return 'current'
    await importBundle(b)
    return 'loaded'
  }

  async function clear() {
    const db = await open()
    if (!db)
      return
    await new Promise((resolve) => {
      const tx = db.transaction(['meta', 'exams'], 'readwrite')
      tx.objectStore('exams').clear()
      tx.objectStore('meta').clear()
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
    index = null
    cache.clear()
  }

  /**
   * Mark one passage. answers: { qid: string | [string] (several blanks), 'q1,q2,q3': [letters] }.
   * match(answer, accepted) -> truthy when accepted (VocabApp.answers.match).
   * Returns { score, total, per: { qid: { ok, got, want } } }.
   */
  function bankMark(exam, answers, match) {
    const per = {}
    let score = 0
    let total = 0
    const done = new Set()
    const eq = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
    for (const q of exam.order) {
      const a = exam.ans[q] || {}
      if (a.multi) {
        if (done.has(a.multi))
          continue
        done.add(a.multi)
        const g = exam.multi.find(m => m.qs === a.multi)
        const qs = g.qs.split(',')
        const chosen = [...new Set(answers[g.qs] || [])]
        const right = chosen.filter(c => g.letters.some(l => eq(l, c)))
        const marks = Math.max(0, right.length - Math.max(0, chosen.length - g.letters.length))
        score += marks
        total += g.marks
        qs.forEach((x, i) => { per[x] = { ok: i < marks && (qs.length > 1 || marks === g.marks), got: chosen.join(', '), want: g.letters.join(', '), part: qs.length === 1 ? `${marks}/${g.marks}` : '' } })
        continue
      }
      total++
      const got = answers[q]
      let ok = false
      if (a.all) {
        const left = a.all.slice()
        const vals = [].concat(got || [])
        ok = vals.length === left.length && vals.every((v) => {
          const i = left.findIndex(w => match(v, w))
          if (i < 0)
            return false
          left.splice(i, 1)
          return true
        })
        per[q] = { ok, got: vals.join(' / '), want: a.all.join(' / ') }
      }
      else {
        const v = Array.isArray(got) ? got.join(' ') : got
        ok = !!v && (a.alts || []).some(w => match(v, w))
        per[q] = { ok, got: v || '', want: (a.alts || []).join(' / ') }
      }
      if (ok)
        score++
    }
    return { score, total, per }
  }

  return { open, loadIndex, getExam, importBundle, fromServer, clear, bankMark, cleanHtml, cleanExam, hasDb: () => typeof indexedDB !== 'undefined' }
})
