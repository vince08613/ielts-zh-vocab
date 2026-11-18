/* Word data expansion and small DOM helpers. */
(function () {
  'use strict'
  const V = window.VocabApp = window.VocabApp || {}
  const raw = window.VOCAB_DATA

  V.data = raw
  V.words = raw.words.map(t => ({ id: t[0], chapter: t[1], group: t[2], words: t[3], pos: t[4], meaning: t[5], example: t[6], extra: t[7] }))
  V.byId = {}
  V.byUid = {}
  // Stable id: chapter number + headword, so progress survives reordering of the source list.
  V.words.forEach((w) => {
    w.uid = `${String(w.chapter + 1).padStart(2, '0')}:${w.words[0].toLowerCase()}`
    V.byId[w.id] = w
    V.byUid[w.uid] = w
  })
  V.chapterWords = raw.chapters.map((_, i) => V.words.filter(w => w.chapter === i))

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }
  V.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c])

  V.chapterName = (i) => {
    if (i === 'all')
      return '全部章节'
    const c = raw.chapters[i]
    return c ? `${String(i + 1).padStart(2, '0')} ${c.name}` : ''
  }

  V.chapterOptions = (selected, withAll) => {
    const out = []
    if (withAll)
      out.push(`<option value="all"${selected === 'all' ? ' selected' : ''}>全部章节 · ${V.words.length} 词</option>`)
    raw.chapters.forEach((c, i) => {
      out.push(`<option value="${i}"${selected === i ? ' selected' : ''}>${V.esc(V.chapterName(i))} · ${c.count} 词</option>`)
    })
    return out.join('')
  }

  V.parseChapter = v => (v === 'all' ? 'all' : Math.max(0, Math.min(raw.chapters.length - 1, Number(v) || 0)))

  V.seg = (name, items, value) => {
    const buttons = items.map((it) => {
      const on = String(it.value) === String(value)
      return `<button type="button" role="radio" aria-checked="${on}" data-value="${V.esc(it.value)}"${it.disabled ? ' disabled' : ''}>`
        + `${it.icon ? V.icon(it.icon) : ''}<span>${V.esc(it.label)}</span>`
        + `${it.sub != null ? `<small>${V.esc(it.sub)}</small>` : ''}</button>`
    })
    return `<div class="seg" role="radiogroup" data-name="${name}">${buttons.join('')}</div>`
  }

  V.fmtDuration = (ms) => {
    const sec = Math.max(0, Math.round(ms / 1000))
    if (sec < 60)
      return `${sec} 秒`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s ? `${m} 分 ${s} 秒` : `${m} 分`
  }

  V.fmtDate = (unixSeconds) => {
    const d = new Date(unixSeconds * 1000)
    const p = n => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  V.wordText = w => w.words.join(' / ')

  let toastTimer = 0
  V.toast = (msg) => {
    const el = document.getElementById('toast')
    if (!el)
      return
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400)
  }
})()
