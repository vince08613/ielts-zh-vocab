/* Shared pieces of the 听力 / 阅读 / 写作 / 口语 pages: stored state, sub-tabs, timers,
   synonym index, and the answer sheet for the learner's own test papers. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const A = V.answers
  const K = V.kit = {}

  A.setSpelling((window.SKILLS_DATA || {}).spelling)

  /* ---------- stored state (IndexedDB key-value store, included in export / import) ---------- */

  K.get = (key, fallback) => {
    const v = V.db.getKV(`sk:${key}`, undefined)
    return v === undefined ? fallback : JSON.parse(JSON.stringify(v))
  }
  K.set = (key, value) => V.db.setKV(`sk:${key}`, value)
  K.id = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

  /** Sub-tabs of a page. items: [{ value, label, icon }]. */
  K.tabs = (items, active) => `<div class="sk-tabs" role="tablist">${items.map(it => `<button type="button" role="tab" data-act="sub" data-value="${it.value}" aria-selected="${it.value === active}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.badge ? `<small>${esc(it.badge)}</small>` : ''}</button>`).join('')}</div>`

  K.head = (title, sub, tabs) => `<div class="sk-head"><div class="sk-title"><h2>${esc(title)}</h2>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}</div>${tabs || ''}</div>`

  K.clock = (sec) => {
    const s = Math.max(0, Math.round(sec))
    const m = Math.floor(s / 60)
    return `${m}:${String(s % 60).padStart(2, '0')}`
  }
  K.date = t => new Date(t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  K.pct = (ok, n) => (n ? `${Math.round((ok / n) * 100)}%` : '—')

  /**
   * A timer that survives the app going to the background: it is computed from timestamps.
   * el shows m:ss counting down from limit (or up when limit is 0); overtime is marked.
   */
  K.ticker = (el, startedAt, limit, onTick) => {
    const update = () => {
      if (!el.isConnected)
        return clearInterval(id)
      const used = (Date.now() - startedAt) / 1000
      if (limit) {
        const left = limit - used
        el.textContent = left >= 0 ? K.clock(left) : `+${K.clock(-left)}`
        el.classList.toggle('over', left < 0)
        el.classList.toggle('low', left >= 0 && left < 60)
      }
      else {
        el.textContent = K.clock(used)
      }
      if (onTick)
        onTick(used)
    }
    const id = setInterval(update, 500)
    update()
    return () => clearInterval(id)
  }

  /** Shuffle (Fisher-Yates) with Math.random. */
  K.shuffle = (list) => {
    const a = list.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  K.normSyn = s => A.norm(s).replace(/\s*…+\s*|\.\.\./g, ' ').replace(/\s+/g, ' ').trim()

  /** Which of the given replacements were written (comma / 、 / ; separated). */
  K.matchSyn = (typed, syn) => {
    const got = String(typed || '').split(/[,，、;；/\n]+/).map(K.normSyn).filter(Boolean)
    const want = syn.map(K.normSyn)
    const hit = want.filter(w => got.some(g => g === w || A.match(g, w)))
    const extra = got.filter(g => !want.some(w => g === w || A.match(g, w)))
    return { hit, extra, typed: got.length }
  }

  let synCache = null
  /** Index of the 听力 179 / 阅读 538 replacements: word -> keywords, keyword -> replacements. */
  K.synIndex = () => {
    if (synCache)
      return synCache
    const byKey = new Map()
    const reverse = new Map()
    for (const w of V.words) {
      if (!w.syn.length)
        continue
      const k = w.words[0].toLowerCase()
      byKey.set(k, Array.from(new Set([...(byKey.get(k) || []), ...w.syn])))
      for (const s of w.syn) {
        const n = K.normSyn(s)
        reverse.set(n, Array.from(new Set([...(reverse.get(n) || []), w])))
      }
    }
    synCache = { byKey, reverse }
    return synCache
  }

  /* ---------- recording ---------- */

  K.canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
  K.canTranscribe = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  /**
   * Start recording (and live transcription when asked and supported).
   * Resolves to a handle { stop(): Promise<{ url, blob, type, transcript, secs }> } or rejects.
   */
  K.record = async ({ transcribe = true, lang = 'en-GB', onText } = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
    const type = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || ''
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks = []
    rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data)
    const started = Date.now()
    rec.start(1000)
    let finalText = ''
    let interim = ''
    let sr = null
    let stopped = false
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (transcribe && SR) {
      try {
        sr = new SR()
        sr.lang = lang
        sr.continuous = true
        sr.interimResults = true
        sr.onresult = (e) => {
          interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal)
              finalText += `${r[0].transcript.trim()} `
            else
              interim += r[0].transcript
          }
          if (onText)
            onText((finalText + interim).trim())
        }
        // Recognition stops by itself after silence on some browsers: restart while recording.
        sr.onend = () => {
          if (!stopped) {
            try {
              sr.start()
            }
            catch (e) {}
          }
        }
        sr.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            stopped = true
            if (onText)
              onText(null)
          }
        }
        sr.start()
      }
      catch (e) {
        sr = null
      }
    }
    return {
      transcribing: !!sr,
      stop: () => new Promise((resolve) => {
        stopped = true
        const endedAt = Date.now()
        if (sr) {
          try {
            sr.stop()
          }
          catch (e) {}
        }
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop())
          const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' })
          // Give the recogniser a moment to deliver its last result.
          setTimeout(() => resolve({ blob, url: URL.createObjectURL(blob), type: blob.type, transcript: (finalText + interim).trim(), secs: (endedAt - started) / 1000 }), sr ? 600 : 0)
        }
        if (rec.state !== 'inactive')
          rec.stop()
        else
          rec.onstop()
      }),
    }
  }

  /* ---------- answer sheet for the learner's own papers ---------- */

  const KIND = {
    listening: { name: '听力', minutes: 30, parts: n => Math.ceil(n / 10), part: i => `Part ${i + 1}`, partOf: n => Math.floor((n - 1) / 10) },
    academic: { name: '学术类阅读', minutes: 60, part: i => `Passage ${i + 1}`, partOf: n => (n <= 13 ? 0 : n <= 26 ? 1 : 2) },
    general: { name: '培训类阅读', minutes: 60, part: i => `Section ${i + 1}`, partOf: n => (n <= 14 ? 0 : n <= 27 ? 1 : 2) },
  }
  K.SHEET_KIND = KIND

  const EXAMPLE = `1 B
2 (the) library
3 23 October / October 23
4-5 B, D
6 TRUE
7 £12.50`

  /**
   * Answer sheet page section. kinds: which paper types this page shows.
   * The host page forwards clicks / input / change events whose data-act starts with "sh-".
   */
  K.sheet = (kinds, onChange) => {
    let view = 'list'
    let editId = ''
    let resultId = ''
    let showWrongOnly = false
    let audio = null // { url, name }
    let stopTick = null
    let root = null

    const sheets = () => K.get('sheets', []).filter(s => kinds.includes(s.kind))
    const results = () => K.get('results', [])
    // One unfinished attempt per page, so a listening paper and a reading paper can both wait.
    const akey = `attempt:${kinds.join('+')}`
    const attempt = () => {
      const a = K.get(akey, null)
      return a && kinds.includes(a.kind) && K.get('sheets', []).some(s => s.id === a.sheet) ? a : null
    }
    const sheetById = id => K.get('sheets', []).find(s => s.id === id)

    function rerender() {
      if (root && root.isConnected)
        render(root)
      if (onChange)
        onChange()
    }

    function listHtml() {
      const list = sheets()
      const res = results()
      const a = attempt()
      const rows = list.map((s) => {
        const mine = res.filter(r => r.sheet === s.id)
        const last = mine[mine.length - 1]
        const best = mine.reduce((b, r) => (!b || r.score > b.score ? r : b), null)
        const n = A.parseKey(s.key).items.length
        return `<li class="sh-row">
          <div class="sh-name"><b>${esc(s.name)}</b><span class="muted">${KIND[s.kind].name} · ${n} 题${mine.length ? ` · 做过 ${mine.length} 次` : ''}</span></div>
          <div class="sh-score">${last ? `<span>最近 <b>${last.score}/${last.total}</b>${last.band != null ? ` · ${last.band}` : ''}</span><span class="muted">最好 ${best.score}/${best.total}</span>` : '<span class="muted">还没做过</span>'}</div>
          <div class="row-actions">
            <button type="button" class="icon-btn sm" data-act="sh-edit" data-id="${s.id}" title="编辑答案" aria-label="编辑答案">${icon('pencil-line')}</button>
            ${last ? `<button type="button" class="icon-btn sm" data-act="sh-last" data-id="${last.id}" title="查看上次结果" aria-label="查看上次结果">${icon('history')}</button>` : ''}
            <button type="button" class="btn primary" data-act="sh-start" data-id="${s.id}">${icon('play')}<span>开始</span></button></div></li>`
      }).join('')
      const recent = res.filter(r => list.some(s => s.id === r.sheet)).slice(-8).reverse()
      return `${a ? `<div class="resume"><div class="resume-text"><strong>有一套题没做完</strong><span>${esc((sheetById(a.sheet) || {}).name || '')} · 已答 ${Object.values(a.answers).filter(Boolean).length} 题</span></div>
          <div class="row-actions"><button type="button" class="btn ghost" data-act="sh-drop">${icon('x')}<span>放弃</span></button><button type="button" class="btn primary" data-act="sh-resume">${icon('play')}<span>继续</span></button></div></div>` : ''}
        <div class="sk-bar"><p class="muted sk-lead">录入真题书的答案后计时作答、自动判分。题目和音频只在这台设备上使用，不会上传。</p>
          <button type="button" class="btn" data-act="sh-new">${icon('plus')}<span>添加一套题</span></button></div>
        ${list.length ? `<ul class="sh-list">${rows}</ul>` : `<div class="empty">${icon('clipboard-list')}<p>还没有题目。点“添加一套题”，把书后答案按“题号 答案”抄进来就能开始。</p></div>`}
        ${recent.length ? `<h3 class="section-title">最近成绩</h3><ul class="sh-list sh-hist">${recent.map((r) => {
          const s = sheetById(r.sheet)
          return `<li class="sh-row"><div class="sh-name"><b>${esc(s ? s.name : '已删除')}</b><span class="muted">${K.date(r.at)} · 用时 ${K.clock(r.secs)}</span></div>
            <div class="sh-score"><span><b>${r.score}/${r.total}</b>${r.band != null ? ` · ${r.band} 分` : ''}</span><span class="muted">错 ${r.total - r.score} 题</span></div>
            <div class="row-actions"><button type="button" class="icon-btn sm" data-act="sh-last" data-id="${r.id}" title="查看" aria-label="查看">${icon('arrow-right')}</button></div></li>`
        }).join('')}</ul>` : ''}`
    }

    function editHtml() {
      const s = editId ? sheetById(editId) : null
      const kind = s ? s.kind : kinds[0]
      return `<div class="panel sh-edit">
        <div class="field"><span class="label">名称</span><input id="sh-name" class="text-input" type="text" value="${esc(s ? s.name : '')}" placeholder="例如：剑桥 18 Test 2 听力" autocomplete="off"></div>
        ${kinds.length > 1 ? `<div class="field"><span class="label">类型</span>${V.seg('sh-kind', kinds.map(k => ({ value: k, label: KIND[k].name })), kind)}</div>` : ''}
        <div class="field sh-keyfield"><span class="label">答案</span><div class="field-stack">
          <textarea id="sh-key" class="text-area" rows="12" spellcheck="false" autocapitalize="none" placeholder="${esc(EXAMPLE)}">${esc(s ? s.key : '')}</textarea>
          <div class="field-note">每行一题：题号 + 答案。可选词放括号里，多个正确答案用 “ / ” 分开，“4-5 B, D” 表示两题顺序不限。英美拼写、大小写、T/F/NG 缩写都会自动兼容。</div>
          <div id="sh-preview" class="sh-preview"></div></div></div>
        <div class="sk-actions">
          ${s ? `<button type="button" class="btn ghost danger" data-act="sh-delete" data-id="${s.id}">${icon('trash-2')}<span>删除</span></button>` : ''}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="sh-cancel">${icon('x')}<span>取消</span></button>
          <button type="button" class="btn primary" data-act="sh-save">${icon('check')}<span>保存</span></button></div>
      </div>`
    }

    function previewKey() {
      const box = root && root.querySelector('#sh-preview')
      if (!box)
        return
      const k = A.parseKey(root.querySelector('#sh-key').value)
      const nums = k.items.map(i => i.n)
      const missing = nums.length ? Array.from({ length: Math.max(...nums) }, (_, i) => i + 1).filter(n => !nums.includes(n)) : []
      box.innerHTML = `<span class="tag">已识别 ${k.items.length} 题</span>${missing.length ? `<span class="tag warn">缺题号 ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}</span>` : ''}${k.errors.length ? `<span class="tag bad">无法识别 ${k.errors.length} 行：${esc(k.errors.slice(0, 2).join(' · '))}</span>` : ''}`
    }

    function partsOf(kind, nums) {
      const parts = []
      for (const n of nums) {
        const p = KIND[kind].partOf(n)
        if (!parts[p])
          parts[p] = []
        parts[p].push(n)
      }
      return parts.map((list, i) => ({ name: KIND[kind].part(i), list: list || [] })).filter(p => p.list.length)
    }

    function runHtml(a) {
      const s = sheetById(a.sheet)
      const key = A.parseKey(s.key)
      const nums = key.items.map(i => i.n)
      const limit = KIND[s.kind].minutes * 60
      const audioBox = s.kind === 'listening'
        ? `<div class="sh-audio">
            ${audio ? `<div class="sh-audio-row">${a.examAudio
              ? `<button type="button" class="btn${a.played ? '' : ' primary'}" data-act="sh-play"${a.played ? ' disabled' : ''}>${icon('headphones')}<span>${a.played ? '已播放（考试模式只播一次）' : '播放音频'}</span></button><span class="muted sh-audio-name">${esc(audio.name)}</span>`
              : `<audio id="sh-player" controls preload="auto" src="${audio.url}"></audio>`}</div>` : ''}
            <div class="sh-audio-row"><label class="btn ghost">${icon('upload')}<span>${audio ? '换一个音频文件' : '选择本地音频（可选）'}</span><input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" data-act="sh-audio" hidden></label>
              <label class="sh-check"><input type="checkbox" data-act="sh-exam"${a.examAudio ? ' checked' : ''}><span>考试模式：只播一次，不能暂停和拖动</span></label></div>
            ${audio && a.examAudio ? `<audio id="sh-player" preload="auto" src="${audio.url}"></audio>` : ''}</div>`
        : ''
      const grid = partsOf(s.kind, nums).map(p => `<section class="sh-part"><h4>${esc(p.name)}</h4><div class="sh-grid">${p.list.map(n => `<label class="sh-cell"><span>${n}</span><input type="text" data-act="sh-ans" data-n="${n}" value="${esc(a.answers[n] || '')}" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="next"></label>`).join('')}</div></section>`).join('')
      return `<div class="sh-run">
        <div class="sh-runhead"><div><b>${esc(s.name)}</b><span class="muted">${KIND[s.kind].name} · ${nums.length} 题 · 建议 ${KIND[s.kind].minutes} 分钟</span></div>
          <div class="sh-timer" title="剩余时间">${icon('timer')}<span id="sh-clock" data-limit="${limit}"></span></div></div>
        ${audioBox}
        <div class="sh-sheet">${grid}</div>
        <div class="sk-actions"><button type="button" class="btn ghost" data-act="sh-pause">${icon('pause')}<span>稍后继续</span></button><span class="spacer"></span>
          <button type="button" class="btn primary lg" data-act="sh-submit">${icon('check')}<span>交卷判分</span></button></div>
      </div>`
    }

    function resultHtml(r) {
      const s = sheetById(r.sheet)
      const kind = s ? s.kind : 'listening'
      const parts = partsOf(kind, r.marks.map(m => m.n)).map((p) => {
        const ok = r.marks.filter(m => p.list.includes(m.n) && m.ok).length
        return { name: p.name, ok, n: p.list.length }
      })
      const rows = r.marks.filter(m => !showWrongOnly || !m.ok)
      return `<div class="summary sh-result">
        <div class="sum-head"><div class="sum-score">${r.score}<small>/${r.total}</small></div>
          <div class="sum-info"><div class="sum-title"><span>${esc(s ? s.name : '')}</span>${r.band != null ? `<span class="tag">约 ${r.band} 分</span>` : ''}</div>
            <div class="sum-tally"><span class="muted">${K.date(r.at)} · 用时 ${K.clock(r.secs)}</span></div></div></div>
        ${r.band != null ? `<p class="muted sk-note">按常用换算表估算（${KIND[kind].name}）。官方说明：各套题的分数线会略有不同。</p>` : ''}
        <div class="sh-parts">${parts.map(p => `<div class="t-row"><span>${esc(p.name)}</span><span class="t-rbar"><span style="width:${(p.ok / p.n) * 100}%" class="${p.ok / p.n < 0.6 ? 'weak' : 'ok'}"></span></span><b>${p.ok}/${p.n}</b></div>`).join('')}</div>
        <div class="sk-bar"><h3 class="section-title">逐题核对</h3><label class="sh-check"><input type="checkbox" data-act="sh-wrongonly"${showWrongOnly ? ' checked' : ''}><span>只看错题（${r.total - r.score}）</span></label></div>
        <ul class="sh-marks">${rows.map(m => `<li class="${m.ok ? 'ok' : 'bad'}"><span class="sh-n">${m.n}</span>${icon(m.ok ? 'check' : 'x')}
          <span class="sh-yours" lang="en">${m.answer ? esc(m.answer) : '<i class="muted">未作答</i>'}</span><span class="sh-key" lang="en">${m.ok ? '' : esc(m.expected)}</span>${m.note ? `<span class="sh-note">${esc(m.note)}</span>` : ''}</li>`).join('')}</ul>
        <div class="sum-actions"><button type="button" class="btn primary" data-act="sh-start" data-id="${r.sheet}">${icon('rotate-ccw')}<span>再做一遍</span></button>
          <button type="button" class="btn ghost" data-act="sh-back">${icon('arrow-right')}<span>返回列表</span></button></div>
      </div>`
    }

    function render(el) {
      root = el
      if (stopTick) {
        stopTick()
        stopTick = null
      }
      const a = attempt()
      if (view === 'run' && !a)
        view = 'list'
      if (view === 'result' && !results().some(r => r.id === resultId))
        view = 'list'
      if (view === 'edit')
        el.innerHTML = editHtml()
      else if (view === 'run')
        el.innerHTML = runHtml(a)
      else if (view === 'result')
        el.innerHTML = resultHtml(results().find(r => r.id === resultId))
      else
        el.innerHTML = listHtml()
      if (view === 'edit')
        previewKey()
      if (view === 'run') {
        const clock = el.querySelector('#sh-clock')
        stopTick = K.ticker(clock, a.started, Number(clock.dataset.limit))
        const player = el.querySelector('#sh-player')
        if (player && a.examAudio) {
          player.onended = () => {
            const cur = attempt()
            if (cur) {
              cur.played = true
              K.set(akey, cur)
              render(root)
            }
          }
        }
      }
    }

    function start(id) {
      const s = sheetById(id)
      if (!s || !A.parseKey(s.key).items.length)
        return V.toast('这套题还没有可识别的答案')
      const cur = attempt()
      if (cur && cur.sheet !== id && !window.confirm('放弃没做完的那套题，开始这一套？'))
        return
      if (!cur || cur.sheet !== id)
        K.set(akey, { sheet: id, kind: s.kind, started: Date.now(), answers: {}, examAudio: true, played: false })
      view = 'run'
      rerender()
      window.scrollTo(0, 0)
    }

    function submit() {
      const a = attempt()
      if (!a)
        return
      const s = sheetById(a.sheet)
      const key = A.parseKey(s.key)
      const blank = key.items.filter(i => !String(a.answers[i.n] || '').trim()).length
      if (blank && !window.confirm(`还有 ${blank} 题没填，确定交卷？`))
        return
      const m = A.markSheet(key, a.answers)
      const r = {
        id: K.id(), sheet: s.id, at: Date.now(), secs: (Date.now() - a.started) / 1000, score: m.score, total: m.total,
        band: m.total >= 30 ? A.band(s.kind, m.score, m.total) : null, marks: m.results,
      }
      K.set('results', results().concat(r).slice(-300))
      K.set(akey, null)
      resultId = r.id
      view = 'result'
      showWrongOnly = false
      rerender()
      window.scrollTo(0, 0)
    }

    function act(name, btn, e) {
      switch (name) {
        case 'sh-new':
          editId = ''
          view = 'edit'
          return rerender()
        case 'sh-edit':
          editId = btn.dataset.id
          view = 'edit'
          return rerender()
        case 'sh-cancel':
        case 'sh-back':
          view = 'list'
          return rerender()
        case 'sh-save': {
          const name = root.querySelector('#sh-name').value.trim()
          const key = root.querySelector('#sh-key').value
          const kindBtn = root.querySelector('.seg[data-name="sh-kind"] [aria-checked="true"]')
          const kind = kindBtn ? kindBtn.dataset.value : kinds[0]
          if (!name)
            return V.toast('先写一个名称')
          if (!A.parseKey(key).items.length)
            return V.toast('没有识别到答案：每行写“题号 答案”')
          const all = K.get('sheets', [])
          const s = all.find(x => x.id === editId)
          if (s)
            Object.assign(s, { name, key, kind })
          else
            all.push({ id: K.id(), name, key, kind, created: Date.now() })
          K.set('sheets', all)
          view = 'list'
          V.toast('已保存')
          return rerender()
        }
        case 'sh-delete':
          if (!window.confirm('删除这套题和它的全部成绩？'))
            return
          K.set('sheets', K.get('sheets', []).filter(s => s.id !== btn.dataset.id))
          K.set('results', results().filter(r => r.sheet !== btn.dataset.id))
          view = 'list'
          return rerender()
        case 'sh-start':
          return start(btn.dataset.id)
        case 'sh-resume':
          view = 'run'
          return rerender()
        case 'sh-drop':
          if (window.confirm('放弃这次作答？已填的答案不会保存。')) {
            K.set(akey, null)
            rerender()
          }
          return
        case 'sh-pause':
          view = 'list'
          return rerender()
        case 'sh-submit':
          return submit()
        case 'sh-last':
          resultId = btn.dataset.id
          view = 'result'
          showWrongOnly = false
          rerender()
          return window.scrollTo(0, 0)
        case 'sh-wrongonly':
          showWrongOnly = btn.checked
          return rerender()
        case 'sh-play': {
          const player = root.querySelector('#sh-player')
          if (player)
            player.play().catch(() => V.toast('无法播放这个音频文件'))
          btn.disabled = true
          btn.querySelector('span').textContent = '正在播放…'
          return
        }
        case 'sh-exam': {
          const a = attempt()
          a.examAudio = btn.checked
          K.set(akey, a)
          return rerender()
        }
        case 'sh-audio': {
          const f = btn.files && btn.files[0]
          if (!f)
            return
          if (audio)
            URL.revokeObjectURL(audio.url)
          audio = { url: URL.createObjectURL(f), name: f.name }
          const a = attempt()
          a.played = false
          K.set(akey, a)
          return rerender()
        }
        case 'sh-ans': {
          const a = attempt()
          if (!a)
            return
          a.answers[btn.dataset.n] = btn.value
          K.set(akey, a)
          if (e && e.type === 'keydown') {
            const inputs = [...root.querySelectorAll('[data-act="sh-ans"]')]
            const next = inputs[inputs.indexOf(btn) + 1]
            if (next)
              next.focus()
          }
          return
        }
      }
    }

    return {
      render,
      act,
      onInput(e) {
        if (e.target.id === 'sh-key')
          previewKey()
        if (e.target.dataset.act === 'sh-ans')
          act('sh-ans', e.target, e)
      },
      onKeydown(e) {
        if (e.key === 'Enter' && e.target.dataset.act === 'sh-ans' && !e.isComposing) {
          e.preventDefault()
          act('sh-ans', e.target, e)
        }
      },
      onSeg(b) {
        if (b.parentElement.dataset.name === 'sh-kind') {
          b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)))
          return true
        }
        return false
      },
      busy: () => view === 'run' || view === 'edit',
      hasAttempt: () => !!attempt(),
    }
  }

  /* ---------- page plumbing ---------- */

  /**
   * Wire a page root: clicks on [data-act] go to onAct(name, el, event); sub-tabs, segmented
   * controls and the answer sheet are routed too. handlers: { onAct, onSeg, onInput, onChange, onKeydown, sheet }
   */
  K.wire = (root, h) => {
    root.addEventListener('click', (e) => {
      const seg = e.target.closest('.seg button')
      if (seg && root.contains(seg) && !seg.disabled) {
        if (h.sheet && h.sheet.onSeg(seg))
          return
        if (h.onSeg)
          return h.onSeg(seg.parentElement.dataset.name, seg.dataset.value, seg)
      }
      const el = e.target.closest('[data-act]')
      if (!el || !root.contains(el) || el.disabled)
        return
      const name = el.dataset.act
      // Inputs act on change / input, not on click.
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'button')
        return
      if (name.startsWith('sh-') && h.sheet)
        return h.sheet.act(name, el, e)
      h.onAct(name, el, e)
    })
    root.addEventListener('change', (e) => {
      const el = e.target
      const name = el.dataset && el.dataset.act
      if (name && name.startsWith('sh-') && h.sheet && el.dataset.act !== 'sh-ans')
        return h.sheet.act(name, el, e)
      if (h.onChange)
        h.onChange(e)
    })
    root.addEventListener('input', (e) => {
      if (h.sheet)
        h.sheet.onInput(e)
      if (h.onInput)
        h.onInput(e)
    })
    root.addEventListener('keydown', (e) => {
      if (h.sheet)
        h.sheet.onKeydown(e)
      if (h.onKeydown)
        h.onKeydown(e)
    })
  }
})()
