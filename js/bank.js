/* 阅读 · 题库: the private IELTS-practice reading bank (239 passages, Chinese explanations).
   Browse by part and frequency, practise one passage under time, review every question with
   the answer and its explanation, and keep records (accuracy, time, streak, wrong questions). */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const A = V.answers
  const S = V.bankStore
  const LIMIT = { P1: 20, P2: 20, P3: 20 }
  const FREQ = { high: '高频', medium: '中频', low: '低频' }
  const PAGE = 30

  let idx = null
  let state = 'init' // init | loading | ready | empty
  let view = 'home' // home | run | result
  let exam = null
  let resultId = ''
  let pane = 'text'
  let shown = PAGE
  let stopTick = null
  let saveTimer = 0
  let savedRange = null
  let body = null

  const filter = () => K.get('bk:filter', { cat: '', freq: [], status: '', q: '' })
  const results = () => K.get('bkres', [])
  const cur = () => K.get('bkrun', null)
  const setCur = r => K.set('bkrun', r)
  const match = (a, b) => !!A.match(a, b)

  async function ensure() {
    if (state === 'ready' || state === 'loading')
      return
    state = 'loading'
    idx = await S.loadIndex()
    let note = ''
    try {
      const r = await S.fromServer()
      if (r === 'loaded') {
        idx = await S.loadIndex()
        note = `已从本机载入题库：${idx.count} 篇`
      }
    }
    catch (e) {}
    state = idx ? 'ready' : 'empty'
    if (note)
      V.toast(note)
    if (body && body.isConnected)
      render(body)
  }

  /* ---------- stats ---------- */

  function bests() {
    const m = new Map()
    for (const r of results()) {
      const b = m.get(r.id) || { n: 0, best: null, last: null }
      b.n++
      if (!b.best || r.score / r.total > b.best.score / b.best.total)
        b.best = r
      b.last = r
      m.set(r.id, b)
    }
    return m
  }

  function statsHtml() {
    const res = results()
    if (!res.length)
      return ''
    const q = res.reduce((s, r) => s + r.total, 0)
    const ok = res.reduce((s, r) => s + r.score, 0)
    const mins = Math.round(res.reduce((s, r) => s + r.secs, 0) / 60)
    // Local calendar days; the streak counts back from today, or from yesterday if nothing yet today.
    const dayKey = (t) => {
      const d = new Date(t)
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    }
    const back = (n) => {
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      d.setDate(d.getDate() - n)
      return dayKey(d)
    }
    const days = new Set(res.map(r => dayKey(r.at)))
    let streak = 0
    for (let n = days.has(back(0)) ? 0 : 1; days.has(back(n)); n++)
      streak++
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const k = back(13 - i)
      return res.filter(r => dayKey(r.at) === k).length
    })
    const max = Math.max(1, ...last14)
    const bars = last14.map((n, i) => `<rect x="${i * 14}" y="${30 - (n / max) * 28}" width="10" height="${Math.max(n ? 2 : 0, (n / max) * 28)}" rx="2"/>`).join('')
    const recent = res.slice(-10)
    const recAcc = recent.reduce((s, r) => s + r.score, 0) / Math.max(1, recent.reduce((s, r) => s + r.total, 0))
    return `<div class="bk-stats">
      <div class="d-stat"><b>${new Set(res.map(r => r.id)).size}</b><span>篇做过</span></div>
      <div class="d-stat"><b>${K.pct(ok, q)}</b><span>总正确率</span></div>
      <div class="d-stat"><b>${Math.round(recAcc * 100)}%</b><span>最近 10 篇</span></div>
      <div class="d-stat"><b>${mins}</b><span>分钟</span></div>
      <div class="d-stat"><b>${streak}</b><span>连续天数</span></div>
      <div class="d-stat bk-trend" title="近 14 天每天做的篇数"><svg viewBox="0 0 196 32" role="img" aria-label="近 14 天">${bars}</svg><span>近 14 天</span></div></div>`
  }

  /* ---------- home ---------- */

  function listOf(f) {
    const b = bests()
    const q = f.q.trim().toLowerCase()
    return idx.list.filter((e) => {
      if (f.cat && e.cat !== f.cat)
        return false
      if (f.freq.length && !f.freq.includes(e.freq))
        return false
      const s = b.get(e.id)
      if (f.status === 'new' && s)
        return false
      if (f.status === 'done' && !s)
        return false
      if (f.status === 'wrong' && !(s && s.last.score < s.last.total))
        return false
      return !q || e.en.toLowerCase().includes(q) || e.zh.includes(q)
    })
  }

  function emptyHtml() {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname) || /^(192\.168|10\.|172\.)/.test(location.hostname)
    return `<div class="panel bk-empty"><h3>${icon('library')}<span>题库还没有载入</span></h3>
      <p>这套 239 篇的阅读题库（含中文解析）来自 IELTS-practice，原作者只允许个人学习使用，所以不放在公开网址上，只保存在你自己的设备里。</p>
      <ol><li>在电脑的“网站”文件夹运行 <code>node tools/build-bank.mjs</code>，生成 <code>雅思自用资料/ielts-bank/ielts-reading-bank.json</code>。</li>
        <li>用电脑上的本机网址（<code>node tools/serve.mjs</code>）打开时会自动载入${local ? '，如果刚生成可以点“重新检查”' : ''}。</li>
        <li>用公开网址（例如 iPad 上）时，把这个 json 文件存到 iPad 的“文件”里，点下面的“导入题库文件”。导入一次后离线也能用。</li></ol>
      <div class="sk-actions"><button type="button" class="btn" data-act="bk-retry">${icon('rotate-ccw')}<span>重新检查</span></button>
        <label class="btn primary file-pick">${icon('upload')}<span>导入题库文件</span><input type="file" accept="application/json,.json" data-act="bk-file" aria-label="导入题库文件"></label></div></div>`
  }

  function homeHtml() {
    if (state !== 'ready')
      return state === 'empty' ? emptyHtml() : '<div class="panel"><span class="muted">正在读取题库…</span></div>'
    const f = filter()
    const b = bests()
    const list = listOf(f)
    const r = cur()
    const resume = r && idx.list.find(e => e.id === r.id)
    const rows = list.slice(0, shown).map((e) => {
      const s = b.get(e.id)
      return `<li class="sh-row bk-row"><div class="sh-name"><b lang="en">${esc(e.en)}</b><span class="muted"><span class="tag ${e.freq === 'high' ? 'bad' : e.freq === 'medium' ? 'warn' : ''}">${FREQ[e.freq] || esc(e.freq)}</span>${esc(e.zh)} · ${e.cat} · ${e.n} 题${e.partial ? ' · 题干不全' : ''}</span></div>
        <div class="sh-score">${s ? `<span>最好 <b>${s.best.score}/${s.best.total}</b></span><span class="muted">做过 ${s.n} 次</span>` : '<span class="muted">未做</span>'}</div>
        <div class="row-actions">${s ? `<button type="button" class="icon-btn sm" data-act="bk-view" data-id="${s.last.rid}" title="看上次的解析" aria-label="看上次的解析">${icon('history')}</button>` : ''}
          <button type="button" class="btn primary" data-act="bk-start" data-id="${e.id}">${icon('play')}<span>开始</span></button></div></li>`
    }).join('')
    const chip = (v, label) => `<button type="button" class="chip-btn" data-act="bk-freq" data-v="${v}" aria-pressed="${f.freq.includes(v)}">${label}</button>`
    return `<div class="bk-home">
      ${resume ? `<div class="resume"><div class="resume-text"><strong>上次没做完</strong><span lang="en">${esc(resume.en)} · 已答 ${answeredCount(r)} 题</span></div>
        <div class="row-actions"><button type="button" class="btn ghost" data-act="bk-drop">${icon('x')}<span>放弃</span></button><button type="button" class="btn primary" data-act="bk-resume">${icon('play')}<span>继续</span></button></div></div>` : ''}
      ${statsHtml()}
      <div class="panel bk-filter">
        ${V.seg('bk-cat', [{ value: '', label: '全部' }, { value: 'P1', label: 'P1' }, { value: 'P2', label: 'P2' }, { value: 'P3', label: 'P3' }], f.cat)}
        <div class="chips">${chip('high', '高频')}${chip('medium', '中频')}${chip('low', '低频')}</div>
        ${V.seg('bk-status', [{ value: '', label: '全部' }, { value: 'new', label: '未做' }, { value: 'done', label: '做过' }, { value: 'wrong', label: '有错题' }], f.status)}
        <input class="text-input bk-search" type="search" data-act="bk-q" value="${esc(f.q)}" placeholder="搜索标题" autocomplete="off">
        <span class="spacer"></span>
        <button type="button" class="btn" data-act="bk-random"${list.length ? '' : ' disabled'}>${icon('shuffle')}<span>随机一篇</span></button></div>
      <p class="muted bk-count">${list.length} 篇${list.length !== idx.count ? ` / 共 ${idx.count} 篇` : ''} · ${idx.questions} 题</p>
      <ul class="sh-list">${rows || '<li class="sh-row"><span class="muted">没有符合条件的文章</span></li>'}</ul>
      ${list.length > shown ? `<div class="sk-actions"><button type="button" class="btn" data-act="bk-more">${icon('plus')}<span>再显示 ${Math.min(PAGE, list.length - shown)} 篇</span></button></div>` : ''}
      <p class="sk-note">${icon('info')}<span>题库来自 sallowayma-git/IELTS-practice，仅供个人学习，已保存在本设备；拖拽题改成了下拉选择。交卷后每题都有答案和中文解析，错题会在“有错题”里列出。</span>
        <button type="button" class="btn ghost sm" data-act="bk-clear">${icon('trash-2')}<span>删除本机题库</span></button></p></div>`
  }

  /* ---------- run ---------- */

  function answeredCount(r) {
    return Object.entries(r.answers).reduce((n, [k, v]) => n + (k.includes(',') ? Math.min(k.split(',').length, (v || []).length) : [].concat(v).some(x => String(x || '').trim()) ? 1 : 0), 0)
  }

  async function start(id) {
    const e = await S.getExam(id)
    if (!e)
      return V.toast('读取文章失败')
    exam = e
    setCur({ id, answers: {}, acc: 0, since: Date.now() })
    view = 'run'
    pane = 'text'
    render(body)
    window.scrollTo(0, 0)
  }

  function pause() {
    const r = cur()
    if (r && r.since) {
      r.acc += (Date.now() - r.since) / 1000
      r.since = null
      setCur(r)
    }
  }

  function examHtml(e, mode) {
    const total = e.order.length
    const r = cur()
    const bar = mode === 'run'
      ? `<button type="button" class="btn ghost" data-act="bk-pause">${icon('pause')}<span>稍后继续</span></button>
         <span class="tag">${e.cat}</span><b class="bk-title" lang="en">${esc(e.en)}</b>
         <div class="rd-pane-seg">${V.seg('bk-pane', [{ value: 'text', label: '原文', icon: 'file-text' }, { value: 'q', label: '题目', icon: 'list-ordered' }], pane)}</div><span class="spacer"></span>
         <span class="muted rd-count">已答 <b id="bk-done">${answeredCount(r)}</b> / ${total}</span>
         <span class="sh-timer" title="建议用时 ${LIMIT[e.cat] || 20} 分钟">${icon('timer')}<span id="bk-clock"></span></span>
         <button type="button" class="btn primary" data-act="bk-submit">${icon('check')}<span>交卷</span></button>`
      : `<button type="button" class="btn ghost" data-act="bk-home">${icon('chevron-left')}<span>题库</span></button>
         <span class="tag">${e.cat}</span><b class="bk-title" lang="en">${esc(e.en)}</b>
         <div class="rd-pane-seg">${V.seg('bk-pane', [{ value: 'text', label: '原文', icon: 'file-text' }, { value: 'q', label: '解析', icon: 'list-ordered' }], pane)}</div><span class="spacer"></span>
         ${e.notes.length ? `<button type="button" class="btn ghost" data-act="bk-notes" aria-pressed="${!!K.get('bk:notes', false)}">${icon('languages')}<span>段落译文</span></button>` : ''}
         <button type="button" class="btn primary" data-act="bk-start" data-id="${e.id}">${icon('rotate-ccw')}<span>重做</span></button>`
    const notes = mode === 'result' && K.get('bk:notes', false) && e.notes.length
      ? `<div class="bk-notes">${e.notes.map(([l, t]) => `<p><b>${esc(l)}</b> ${esc(t)}</p>`).join('')}</div>` : ''
    return `<div class="rd-run bk-run${pane === 'q' ? ' show-q' : ''}">
      <div class="rd-bar">${bar}</div>
      ${mode === 'result' ? resultHead() : ''}
      <div class="rd-split${mode === 'result' ? ' rd-split-result' : ''}${pane === 'q' ? ' show-q' : ''}">
        <div class="rd-text">${mode === 'run' ? `<div class="rd-tools"><button type="button" class="btn ghost" data-act="bk-hl">${icon('highlighter')}<span>划线</span></button>
          <button type="button" class="btn ghost" data-act="bk-hl-clear">${icon('x')}<span>清除划线</span></button></div>` : ''}
          ${notes}<article class="bk-article" lang="en">${e.passage}</article></div>
        <div class="rd-qs bk-qs" lang="en">${e.groups.map((g, i) => `<section class="rd-group bk-group" data-g="${i}">${g.html}</section>`).join('')}
          ${mode === 'run' ? `<div class="sk-actions"><span class="spacer"></span><button type="button" class="btn primary" data-act="bk-submit">${icon('check')}<span>交卷</span></button></div>` : ''}</div></div></div>`
  }

  function resultHead() {
    const r = results().find(x => x.rid === resultId)
    if (!r)
      return ''
    const pct = Math.round((r.score / r.total) * 100)
    return `<div class="panel bk-result"><div class="sd-sum-score"><b>${r.score}</b><span>/ ${r.total}</span></div>
      <div><b>${pct}%</b><div class="muted">用时 ${V.fmtDuration(r.secs * 1000)} · ${K.date(r.at)}${r.wrong.length ? ` · 错 ${r.wrong.length} 题` : ' · 全对'}</div></div>
      <span class="spacer"></span><label class="sh-check"><input type="checkbox" data-act="bk-wrongonly"${K.get('bk:wrongonly', false) ? ' checked' : ''}><span>只看错题的解析</span></label></div>`
  }

  // Put saved answers back into the controls.
  function restore(root, answers) {
    root.querySelectorAll('[data-q], [data-qs]').forEach((c) => {
      if (c.dataset.qs) {
        c.checked = (answers[c.dataset.qs] || []).includes(c.value)
        return
      }
      const v = answers[c.dataset.q]
      if (c.type === 'radio')
        c.checked = v === c.value
      else if (c.classList.contains('bk-blank'))
        c.value = Array.isArray(v) ? v[Number(c.dataset.i)] || '' : Number(c.dataset.i) === 0 ? v || '' : ''
      else if (c.tagName === 'SELECT')
        c.value = v || ''
    })
    root.querySelectorAll('.bk-slot').forEach((s) => {
      const v = answers[s.dataset.q]
      s.textContent = `${exam.num[s.dataset.q] || s.dataset.q.slice(1)}${v ? ` · ${v}` : ''}`
      s.classList.toggle('filled', !!v)
    })
  }

  function collect(c) {
    const r = cur()
    if (!r)
      return
    if (c.dataset.qs) {
      const all = [...body.querySelectorAll(`[data-qs="${c.dataset.qs}"]`)]
      const max = c.dataset.qs.split(',').length > 1 ? c.dataset.qs.split(',').length : ((exam.multi.find(m => m.qs === c.dataset.qs) || {}).marks || 9)
      const on = all.filter(x => x.checked).map(x => x.value)
      if (on.length > max) {
        c.checked = false
        V.toast(`这题选 ${max} 个`)
        return
      }
      r.answers[c.dataset.qs] = on
    }
    else if (c.classList.contains('bk-blank')) {
      const all = [...body.querySelectorAll(`.bk-blank[data-q="${c.dataset.q}"]`)]
      r.answers[c.dataset.q] = all.length > 1 ? all.map(x => x.value) : c.value
    }
    else {
      r.answers[c.dataset.q] = c.value
    }
    setCur(r)
    const done = body.querySelector('#bk-done')
    if (done)
      done.textContent = answeredCount(r)
    if (c.tagName === 'SELECT')
      restore(body.querySelector('.bk-article'), r.answers)
  }

  function submit() {
    const r = cur()
    const n = answeredCount(r)
    if (n < exam.order.length && !window.confirm(`还有 ${exam.order.length - n} 题没答，确定交卷？`))
      return
    pause()
    const m = S.bankMark(exam, r.answers, match)
    const res = { rid: K.id(), id: exam.id, at: Date.now(), secs: Math.round(cur().acc), score: m.score, total: m.total, wrong: Object.entries(m.per).filter(([, x]) => !x.ok).map(([q]) => q), answers: r.answers }
    K.set('bkres', results().concat(res).slice(-400))
    setCur(null)
    if (V.daily)
      V.daily.mark('read', 1)
    resultId = res.rid
    view = 'result'
    pane = 'q'
    render(body)
    window.scrollTo(0, 0)
  }

  // Answers, marks and explanations in the question pane after submitting.
  function annotate(root, r) {
    const m = S.bankMark(exam, r.answers, match)
    const wrongOnly = K.get('bk:wrongonly', false)
    restore(root, r.answers)
    root.querySelectorAll('input, select').forEach((c) => {
      if (c.dataset.act)
        return
      c.disabled = true
      const q = c.dataset.q || (c.dataset.qs || '').split(',')[0]
      const p = m.per[q]
      if (!p)
        return
      if (c.type === 'radio' || c.type === 'checkbox') {
        const want = c.type === 'radio' ? (exam.ans[q].alts || []) : exam.multi.find(x => x.qs === c.dataset.qs).letters
        const lab = c.closest('label') || c.parentElement
        if (want.some(w => match(c.value, w)))
          lab.classList.add('bk-right')
        else if (c.checked)
          lab.classList.add('bk-wrong')
        return
      }
      c.classList.add(p.ok ? 'bk-ok' : 'bk-bad')
      const sib = c.nextElementSibling
      if (!p.ok && !(sib && sib.classList.contains('bk-want')) && (c.dataset.i || '0') === '0')
        c.insertAdjacentHTML('afterend', `<span class="bk-want">${esc(p.want)}</span>`)
    })
    root.querySelectorAll('.bk-group').forEach((sec) => {
      const g = exam.groups[Number(sec.dataset.g)]
      const items = g.qids.map((q) => {
        const p = m.per[q] || {}
        if (wrongOnly && p.ok)
          return ''
        const xp = exam.xp[q]
        return `<details class="bk-xp ${p.ok ? 'ok' : 'bad'}"${p.ok ? '' : ' open'}><summary>${icon(p.ok ? 'circle-check' : 'circle-x')}<b>${esc(exam.num[q] || q.slice(1))}</b>
          <span>你的答案 <b>${esc(p.got || '未答')}</b>${p.ok ? '' : ` · 正确 <b>${esc(p.want)}</b>`}${p.part ? ` · 得分 ${p.part}` : ''}</span></summary>
          ${xp ? `<div class="bk-xptext" lang="zh-CN">${esc(xp).replace(/\n/g, '<br>')}</div>` : '<div class="muted">这题没有解析</div>'}</details>`
      }).join('')
      sec.insertAdjacentHTML('beforeend', `<div class="bk-xps">${items}</div>`)
    })
  }

  function highlight() {
    const sel = window.getSelection()
    const r = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : savedRange
    const art = body.querySelector('.bk-article')
    if (!r || r.collapsed || !art || !art.contains(r.commonAncestorContainer))
      return V.toast('先在原文里选中一段文字')
    try {
      const mark = document.createElement('mark')
      mark.className = 'hl'
      mark.appendChild(r.extractContents())
      r.insertNode(mark)
    }
    catch (e) {
      V.toast('这段不能划线，换一段试试')
    }
    window.getSelection().removeAllRanges()
    savedRange = null
  }

  /* ---------- page ---------- */

  async function render(el) {
    body = el
    if (stopTick) {
      stopTick()
      stopTick = null
    }
    if (state === 'init')
      ensure()
    if (view === 'run' || view === 'result') {
      const r = view === 'run' ? cur() : results().find(x => x.rid === resultId)
      if (!r) {
        view = 'home'
      }
      else {
        if (!exam || exam.id !== r.id)
          exam = await S.getExam(r.id)
        if (!exam) {
          view = 'home'
        }
        else {
          if (view === 'run' && !r.since) {
            r.since = Date.now()
            setCur(r)
          }
          body.innerHTML = examHtml(exam, view)
          if (view === 'run') {
            restore(body, r.answers)
            stopTick = K.ticker(body.querySelector('#bk-clock'), r.since - r.acc * 1000, (LIMIT[exam.cat] || 20) * 60)
          }
          else {
            annotate(body.querySelector('.bk-qs'), r)
            restore(body.querySelector('.bk-article'), r.answers)
          }
          return
        }
      }
    }
    body.innerHTML = homeHtml()
  }

  async function act(name, el) {
    const f = filter()
    switch (name) {
      case 'bk-retry':
        state = 'init'
        return render(body)
      case 'bk-start': return start(el.dataset.id)
      case 'bk-resume':
        view = 'run'
        return render(body)
      case 'bk-drop':
        if (window.confirm('放弃这次作答？'))
          setCur(null)
        return render(body)
      case 'bk-pause':
        pause()
        view = 'home'
        return render(body)
      case 'bk-home':
        view = 'home'
        return render(body)
      case 'bk-submit': return submit()
      case 'bk-view':
        resultId = el.dataset.id
        view = 'result'
        pane = 'q'
        render(body)
        return window.scrollTo(0, 0)
      case 'bk-notes':
        K.set('bk:notes', !K.get('bk:notes', false))
        pane = 'text'
        return render(body)
      case 'bk-freq':
        f.freq = f.freq.includes(el.dataset.v) ? f.freq.filter(x => x !== el.dataset.v) : f.freq.concat(el.dataset.v)
        K.set('bk:filter', f)
        shown = PAGE
        return render(body)
      case 'bk-more':
        shown += PAGE
        return render(body)
      case 'bk-random': {
        const list = listOf(f)
        const fresh = list.filter(e => !bests().has(e.id))
        const pool = fresh.length ? fresh : list
        return start(pool[Math.floor(Math.random() * pool.length)].id)
      }
      case 'bk-hl': return highlight()
      case 'bk-hl-clear':
        body.querySelectorAll('.bk-article mark.hl').forEach(m => m.replaceWith(...m.childNodes))
        return
      case 'bk-clear':
        if (!window.confirm('删除本设备上保存的题库？做题记录会保留，以后可以重新导入。'))
          return
        await S.clear()
        idx = null
        state = 'empty'
        return render(body)
    }
  }

  async function onChange(e) {
    const c = e.target
    if (c.dataset.act === 'bk-file') {
      const file = c.files && c.files[0]
      if (!file)
        return
      try {
        V.toast('正在导入…')
        idx = await S.importBundle(JSON.parse(await file.text()))
        state = 'ready'
        V.toast(`已导入 ${idx.count} 篇、${idx.questions} 题`)
      }
      catch (err) {
        V.toast(err.message || '导入失败')
      }
      return render(body)
    }
    if (c.dataset.act === 'bk-wrongonly') {
      K.set('bk:wrongonly', c.checked)
      return render(body)
    }
    if (view === 'run' && (c.dataset.q || c.dataset.qs) && body.contains(c))
      collect(c)
  }

  function onInput(e) {
    const c = e.target
    if (c.dataset.act === 'bk-q') {
      const f = filter()
      f.q = c.value
      K.set('bk:filter', f)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        const pos = c.selectionStart
        shown = PAGE
        render(body).then(() => {
          const again = body.querySelector('[data-act="bk-q"]')
          if (again) {
            again.focus()
            again.setSelectionRange(pos, pos)
          }
        })
      }, 250)
      return
    }
    if (view === 'run' && c.classList.contains('bk-blank'))
      collect(c)
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.classList.contains('bk-blank')) {
      e.preventDefault()
      const all = [...body.querySelectorAll('.bk-blank')]
      const next = all[all.indexOf(e.target) + 1]
      if (next)
        next.focus()
      else
        e.target.blur()
    }
  }

  function onSeg(name, value) {
    const f = filter()
    if (name === 'bk-cat' || name === 'bk-status') {
      f[name === 'bk-cat' ? 'cat' : 'status'] = value
      K.set('bk:filter', f)
      shown = PAGE
      return render(body)
    }
    if (name === 'bk-pane') {
      pane = value
      body.querySelectorAll('.bk-run, .bk-run .rd-split').forEach(x => x.classList.toggle('show-q', value === 'q'))
      body.querySelectorAll('[data-name="bk-pane"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === value)))
    }
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()
    const art = body && body.querySelector('.bk-article')
    if (art && sel && sel.rangeCount && !sel.isCollapsed && art.contains(sel.anchorNode))
      savedRange = sel.getRangeAt(0).cloneRange()
  })

  V.bank = { render, act, onChange, onInput, onKeydown, onSeg, leave: () => { pause(); if (stopTick) stopTick(); if (view === 'result') view = 'home' }, busy: () => view === 'run' }
})()
