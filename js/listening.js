/* 听力: 179 keyword dictation with replacements, Section 1 information dictation read by the
   system voice, British / American spelling, an answer sheet for the learner's own papers, and
   exam notes. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const A = V.answers
  const SK = window.SKILLS_DATA || { spelling: [], spellingNote: '' }

  const TABS = [
    { value: '179', label: '179 考点词', icon: 'headphones' },
    { value: 'info', label: '信息听写', icon: 'audio-lines' },
    { value: 'spell', label: '英美拼写', icon: 'spell-check' },
    { value: 'sheet', label: '答题卡', icon: 'clipboard-list' },
    { value: 'tips', label: '题型与技巧', icon: 'lightbulb' },
  ]
  const RATES = [{ value: '0.8', label: '慢' }, { value: '0.95', label: '正常' }, { value: '1.08', label: '快' }]
  const RUN_LEN = 10

  let root = null
  let body = null
  let tab = '179'
  const book = V.bookIndex('L179')
  const drill = V.synDrill({ key: 'l179', chapter: book, modes: ['listen', 'word', 'reverse'], groupName: i => `第 ${i + 1} 组`, daily: 'l179' })
  const sheet = K.sheet(['listening'])

  /* ---------- Section 1 information dictation ---------- */

  let dLast = null
  let dSummary = null
  const dCfg = () => Object.assign({ kind: 'mixed', rate: '0.95', once: true }, K.get('dictcfg', {}))
  const dRun = () => K.get('dictrun', null)
  const dSave = r => K.set('dictrun', r)

  function dStart() {
    const c = dCfg()
    const items = Array.from({ length: RUN_LEN }, () => A.makeDictation(c.kind === 'mixed' ? '' : c.kind, Math.random))
    dSave({ active: true, kind: c.kind, items, pos: 0, answers: [], plays: 0, started: Date.now() })
    dLast = null
    dSummary = null
    renderBody()
    dFocus()
  }

  function dPlay() {
    const r = dRun()
    if (!r)
      return
    const c = dCfg()
    if (c.once && r.plays > 0)
      return
    r.plays++
    dSave(r)
    const btn = body.querySelector('[data-act="d-play"]')
    if (btn && c.once) {
      btn.disabled = true
      btn.querySelector('span').textContent = '正在播放'
    }
    V.say(r.items[r.pos].say, { rate: Number(c.rate) }).then(() => {
      if (btn && btn.isConnected && c.once)
        btn.querySelector('span').textContent = '已播放'
    })
    dFocus()
  }

  function dFocus() {
    const input = body && body.querySelector('#d-answer')
    if (input)
      input.focus({ preventScroll: true })
  }

  function dSubmit() {
    const r = dRun()
    const input = body.querySelector('#d-answer')
    if (!r || !input)
      return
    const item = r.items[r.pos]
    if (!r.plays && !input.value.trim()) {
      V.toast('先播放再作答')
      return
    }
    const res = A.judgeDictation(item, input.value)
    r.answers.push({ answer: input.value, ok: res.ok, note: res.note, plays: r.plays })
    dLast = { item, answer: input.value, res, plays: r.plays }
    const stats = K.get('dictstats', {})
    const s = stats[item.kind] || { n: 0, ok: 0 }
    s.n++
    if (res.ok)
      s.ok++
    stats[item.kind] = s
    K.set('dictstats', stats)
    if (V.daily)
      V.daily.mark('dict', 1)
    r.pos++
    r.plays = 0
    if (r.pos >= r.items.length) {
      dSummary = { items: r.items, answers: r.answers, secs: (Date.now() - r.started) / 1000 }
      dSave(null)
      return renderBody()
    }
    dSave(r)
    renderBody()
    // A moment to read the feedback before the next sentence starts.
    const pos = r.pos
    setTimeout(() => {
      const cur = dRun()
      if (cur && cur.active && cur.pos === pos && !cur.plays && body.querySelector('#d-answer'))
        dPlay()
    }, 900)
  }

  function dFeedback() {
    if (!dLast)
      return ''
    const { item, answer, res } = dLast
    return `<div class="sd-fb ${res.ok ? 'is-right' : 'is-wrong'}" aria-live="polite">
      <div class="sd-fb-head"><span class="muted">上一题</span>${res.ok ? `<span class="verdict v-right">${icon('circle-check')}<span>正确</span></span>` : `<span class="verdict v-wrong">${icon('circle-x')}<span>不对</span></span>`}
        <span class="tag">${esc(item.label)}</span><span class="spacer"></span>
        <button type="button" class="icon-btn sm" data-act="d-replay-last" title="再听上一题" aria-label="再听上一题">${icon('rotate-ccw')}</button></div>
      <div class="sd-fb-row"><span class="label">答案</span><b lang="en">${esc(item.answer)}</b>${!res.ok ? `<span class="sd-yours">你写的 <s lang="en">${esc(answer || '（空）')}</s></span>` : ''}</div>
      ${res.note ? `<div class="sd-fb-row"><span class="label">提示</span><span>${esc(res.note)}</span></div>` : ''}
      <div class="sd-fb-row"><span class="label">原文</span><span lang="en" class="d-say">${esc(item.say)}</span></div></div>`
  }

  function infoHtml() {
    const c = dCfg()
    const r = dRun()
    if (dSummary) {
      const ok = dSummary.answers.filter(a => a.ok).length
      const rows = dSummary.items.map((it, i) => {
        const a = dSummary.answers[i]
        return `<li class="d-row ${a.ok ? 'ok' : 'bad'}"><span class="tag">${esc(it.label)}</span><b lang="en">${esc(it.answer)}</b>
          <span class="${a.ok ? 'muted' : 'd-wrong'}" lang="en">${a.ok ? '' : esc(a.answer || '（空）')}</span>
          <span class="muted d-say" lang="en">${esc(it.say)}</span></li>`
      }).join('')
      return `<div class="sd-sum">${dFeedback()}
        <div class="panel sd-sum-box"><div class="sd-sum-score"><b>${ok}</b><span>/ ${dSummary.items.length}</span></div>
          <div><b>信息听写</b> 完成<div class="muted">用时 ${V.fmtDuration(dSummary.secs * 1000)}</div></div></div>
        <ul class="d-list">${rows}</ul>
        <div class="sk-actions"><button type="button" class="btn ghost" data-act="d-home">${icon('list')}<span>返回</span></button><span class="spacer"></span>
          <button type="button" class="btn primary" data-act="d-start">${icon('rotate-ccw')}<span>再来 ${RUN_LEN} 题</span></button></div></div>`
    }
    if (r && r.active) {
      const item = r.items[r.pos]
      const locked = c.once && r.plays > 0
      return `<div class="sd-run">
        <div class="sd-top"><span class="tag">${esc(item.label)}</span><span class="muted sd-count">${r.pos + 1} / ${r.items.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="d-quit">${icon('pause')}<span>暂停</span></button></div>
        <div class="sd-q panel">
          <div class="sd-prompt"><button type="button" class="sd-play" data-act="d-play"${locked ? ' disabled' : ''} title="播放" aria-label="播放">${icon('volume-2')}<span>${locked ? '已播放' : r.plays ? '再听一遍' : '播放'}</span></button>
            <div class="sd-meta"><b lang="en">${esc(item.prompt)}</b><span class="muted">${c.once ? '只播一遍' : `已听 ${r.plays} 遍`}</span></div></div>
          <div class="sd-inputs"><input id="d-answer" class="text-input sd-input" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="${esc(item.prompt)}"></div>
          <div class="sk-actions"><span class="spacer"></span><button type="button" class="btn primary" data-act="d-submit">${icon('check')}<span>提交</span></button></div></div>
        ${dFeedback()}</div>`
    }
    const stats = K.get('dictstats', {})
    const kinds = Object.keys(A.KINDS)
    const statRows = kinds.map((k) => {
      const s = stats[k]
      return `<div class="d-stat"><span>${esc(A.KINDS[k])}</span><b>${s ? K.pct(s.ok, s.n) : '—'}</b><small class="muted">${s ? `${s.n} 题` : ''}</small></div>`
    }).join('')
    return `<div class="d-home">
      ${r ? `<div class="resume"><div class="resume-text"><strong>上次没做完</strong><span>第 ${r.pos + 1} / ${r.items.length} 题</span></div>
        <div class="row-actions"><button type="button" class="btn ghost" data-act="d-drop">${icon('x')}<span>放弃</span></button><button type="button" class="btn primary" data-act="d-resume">${icon('play')}<span>继续</span></button></div></div>` : ''}
      <div class="panel d-setup">
        <div class="field"><span class="label">题型</span><select id="d-kind" aria-label="题型"><option value="mixed"${c.kind === 'mixed' ? ' selected' : ''}>混合</option>${kinds.map(k => `<option value="${k}"${c.kind === k ? ' selected' : ''}>${esc(A.KINDS[k])}</option>`).join('')}</select></div>
        <div class="field"><span class="label">语速</span>${V.seg('d-rate', RATES, c.rate)}</div>
        <label class="switch-row"><span>只播一遍</span><input type="checkbox" class="switch" id="d-once"${c.once ? ' checked' : ''}></label>
        <div class="sk-actions"><span class="muted">${V.store.settings.accent === 'en-US' ? '美音' : '英音'} · 系统语音朗读</span><span class="spacer"></span>
          <button type="button" class="btn primary lg" data-act="d-start">${icon('play')}<span>开始 ${RUN_LEN} 题</span></button></div>
      </div>
      <h3 class="section-title">各题型正确率</h3>
      <div class="d-stats">${statRows}</div></div>`
  }

  /* ---------- British / American spelling ---------- */

  let spQuery = ''
  let spRun = null
  let spLast = null

  function spStart() {
    const rows = K.shuffle(SK.spelling).slice(0, RUN_LEN)
    spRun = { rows, pos: 0, ok: 0 }
    spLast = null
    renderBody()
    spPlay()
  }
  const spForm = row => (V.store.settings.accent === 'en-US' ? row.us[0] : row.uk[0])
  function spPlay() {
    if (!spRun || spRun.pos >= spRun.rows.length)
      return
    V.say(spForm(spRun.rows[spRun.pos]), { rate: 0.85 })
    const input = body.querySelector('#sp-answer')
    if (input)
      input.focus({ preventScroll: true })
  }
  function spSubmit() {
    const input = body.querySelector('#sp-answer')
    if (!spRun || !input || !input.value.trim())
      return
    const row = spRun.rows[spRun.pos]
    const t = A.norm(input.value)
    const forms = [...row.uk, ...row.us]
    const ok = forms.some(f => A.norm(f) === t)
    if (ok)
      spRun.ok++
    spLast = { row, answer: input.value, ok }
    spRun.pos++
    renderBody()
    spPlay()
  }

  function spellHtml() {
    const fb = spLast
      ? `<div class="sd-fb ${spLast.ok ? 'is-right' : 'is-wrong'}"><div class="sd-fb-head"><span class="muted">上一题</span>${spLast.ok ? `<span class="verdict v-right">${icon('circle-check')}<span>正确</span></span>` : `<span class="verdict v-wrong">${icon('circle-x')}<span>拼错了</span></span>`}</div>
        <div class="sd-fb-row"><span class="label">英式</span><b lang="en">${esc(spLast.row.uk.join(' / '))}</b></div>
        <div class="sd-fb-row"><span class="label">美式</span><b lang="en">${esc(spLast.row.us.join(' / '))}</b></div>
        ${!spLast.ok ? `<div class="sd-fb-row"><span class="label">你写的</span><s lang="en">${esc(spLast.answer)}</s></div>` : ''}
        <div class="sd-fb-row"><span class="label">释义</span><span>${esc(spLast.row.zh)}</span></div></div>`
      : ''
    if (spRun && spRun.pos < spRun.rows.length) {
      return `<div class="sd-run"><div class="sd-top"><span class="tag">拼写听写</span><span class="muted sd-count">${spRun.pos + 1} / ${spRun.rows.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="sp-quit">${icon('x')}<span>结束</span></button></div>
        <div class="sd-q panel"><div class="sd-prompt"><button type="button" class="sd-play" data-act="sp-play" title="播放" aria-label="播放">${icon('volume-2')}<span>播放</span></button>
          <div class="sd-meta"><span class="muted">英式、美式拼写都算对</span></div></div>
          <div class="sd-inputs"><input id="sp-answer" class="text-input sd-input" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="听到的单词"></div>
          <div class="sk-actions"><span class="spacer"></span><button type="button" class="btn primary" data-act="sp-submit">${icon('check')}<span>提交</span></button></div></div>
        ${fb}</div>`
    }
    const q = spQuery.trim().toLowerCase()
    const rows = SK.spelling.filter(r => !q || [...r.uk, ...r.us].some(f => f.includes(q)) || r.zh.includes(q))
    return `<div class="sp">
      ${spRun ? `<div class="sd-sum">${fb}<div class="panel sd-sum-box"><div class="sd-sum-score"><b>${spRun.ok}</b><span>/ ${spRun.rows.length}</span></div><div><b>拼写听写</b> 完成</div></div></div>` : ''}
      <div class="toolbar"><label class="search">${icon('search')}<input id="sp-search" type="search" placeholder="搜索单词或中文" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="${esc(spQuery)}"></label>
        <button type="button" class="btn primary" data-act="sp-start">${icon('headphones')}<span>听写 ${RUN_LEN} 个</span></button></div>
      <p class="sk-note">${icon('info')}<span>${esc(SK.spellingNote)}。同一篇作文里保持一种拼写。</span></p>
      <table class="sk-table sp-table"><thead><tr><th>英式</th><th>美式</th><th>释义</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr><td lang="en">${esc(r.uk.join(' / '))}</td><td lang="en">${esc(r.us.join(' / '))}</td><td>${esc(r.zh)}</td>
          <td><button type="button" class="icon-btn sm" data-act="sp-say" data-w="${esc(spForm(r))}" title="发音" aria-label="发音">${icon('volume-2')}</button></td></tr>`).join('')}</tbody></table>
      ${rows.length ? '' : `<div class="empty">${icon('search')}<p>没有匹配的单词</p></div>`}</div>`
  }

  /* ---------- notes ---------- */

  const PARTS = [
    ['Part 1', '两人对话，日常生活场景（订房、报名、咨询）。表格或笔记填空为主，考姓名拼写、数字、日期、地址。'],
    ['Part 2', '一人独白，日常话题（场馆介绍、活动安排）。选择、匹配、地图题较多。'],
    ['Part 3', '最多四人讨论学习或培训任务（学生和导师）。选择和匹配为主，说话人常改口、互相否定。'],
    ['Part 4', '一人学术讲座，中间没有停顿。多为笔记或摘要填空，答案按顺序出现。'],
  ]
  const TIPS = [
    ['每部分开始前先读题', '用好开始前和中间的停顿：划关键词，预判空格要填的词性（名词、数字、形容词）和单复数。'],
    ['听同义替换，不听原词', '题干里的词很少原样出现。179 考点词就是高频替换对，例如 reserve ↔ book。'],
    ['错过就放下', '只播一遍。听到下一题的关键词，说明上一题已经过去，马上跟到下一题。'],
    ['以最后确认的信息为准', 'Part 1 常先说一个再改口：Actually, it’s Thursday, not Tuesday。'],
    ['数字和字母', 'oh = 0，double / triple 表示重复；15 与 50 靠重音区分；日期写 21 March 这类形式。'],
    ['字数和拼写', '遵守 NO MORE THAN TWO WORDS AND/OR A NUMBER；拼错或单复数错都不得分；英美拼写都可以。'],
    ['考试形式', '纸笔考试结束后有 10 分钟誊写答案；机考只有约 2 分钟检查，听的时候就要直接写准。'],
  ]

  function tipsHtml() {
    const table = A.BANDS.listening.filter(([, b]) => b >= 4)
    return `<div class="tips">
      <h3 class="section-title">四个部分</h3>
      <dl class="tips-list">${PARTS.map(([t, d]) => `<div><dt>${t}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <h3 class="section-title">做题方法</h3>
      <dl class="tips-list">${TIPS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <h3 class="section-title">分数换算（约）</h3>
      <div class="band-table" role="table">${table.map(([min, b], i) => `<div role="row"><span role="cell">${min}–${i ? table[i - 1][0] - 1 : 40}</span><b role="cell">${b}</b></div>`).join('')}</div>
      <p class="sk-note">${icon('info')}<span>满分 40 题。官方给出的平均线：答对 16、23、30、35 题约为 5、6、7、8 分，每套题的换算略有不同。</span></p>
      <div class="sk-actions"><button type="button" class="btn" data-act="go-res">${icon('library')}<span>官方免费练习</span></button></div></div>`
  }

  /* ---------- page ---------- */

  function renderBody() {
    if (!body)
      return
    if (tab === '179')
      drill.render(body)
    else if (tab === 'info')
      body.innerHTML = infoHtml()
    else if (tab === 'spell')
      body.innerHTML = spellHtml()
    else if (tab === 'sheet')
      sheet.render(body)
    else
      body.innerHTML = tipsHtml()
  }

  function render() {
    tab = K.get('tab:listening', '179')
    if (!TABS.some(t => t.value === tab))
      tab = '179'
    root.innerHTML = `<div class="skill">${K.head('听力', '', K.tabs(TABS, tab))}<div class="sk-body"></div></div>`
    body = root.querySelector('.sk-body')
    renderBody()
  }

  function leave() {
    drill.leave()
    const r = dRun()
    if (r && r.active) {
      r.active = false
      dSave(r)
    }
    dLast = null
    V.stopSpeech()
  }

  function onAct(name, el) {
    if (name === 'sub') {
      leave()
      K.set('tab:listening', el.dataset.value)
      return render()
    }
    if (name.startsWith('sd-'))
      return drill.act(name, el)
    switch (name) {
      case 'd-start': return dStart()
      case 'd-play': return dPlay()
      case 'd-submit': return dSubmit()
      case 'd-replay-last':
        if (dLast)
          V.say(dLast.item.say, { rate: Number(dCfg().rate) })
        return
      case 'd-quit': {
        const r = dRun()
        if (r) {
          r.active = false
          dSave(r)
        }
        dLast = null
        V.stopSpeech()
        return renderBody()
      }
      case 'd-resume': {
        const r = dRun()
        r.active = true
        r.plays = 0
        dSave(r)
        renderBody()
        return dFocus()
      }
      case 'd-drop':
        dSave(null)
        return renderBody()
      case 'd-home':
        dSummary = null
        dLast = null
        return renderBody()
      case 'sp-start': return spStart()
      case 'sp-play': return spPlay()
      case 'sp-submit': return spSubmit()
      case 'sp-quit':
        spRun = null
        spLast = null
        return renderBody()
      case 'sp-say': return V.say(el.dataset.w, { rate: 0.85 })
      case 'go-res': return V.go('resources')
    }
  }

  V.pages = V.pages || {}
  V.pages.listening = {
    mount(el) {
      root = el
      K.wire(el, {
        sheet: { act: (n, b, e) => tab === 'sheet' && sheet.act(n, b, e), onInput: e => tab === 'sheet' && sheet.onInput(e), onKeydown: e => tab === 'sheet' && sheet.onKeydown(e), onSeg: b => tab === 'sheet' && sheet.onSeg(b) },
        onAct,
        onSeg(name, value) {
          if (name.startsWith('sd-'))
            return drill.onSeg(name, value)
          if (name === 'd-rate') {
            K.set('dictcfg', Object.assign(dCfg(), { rate: value }))
            return renderBody()
          }
        },
        onChange(e) {
          if (e.target.id === 'd-kind') {
            K.set('dictcfg', Object.assign(dCfg(), { kind: e.target.value }))
          }
          else if (e.target.id === 'd-once') {
            K.set('dictcfg', Object.assign(dCfg(), { once: e.target.checked }))
          }
        },
        onInput(e) {
          if (tab === '179')
            drill.onInput(e)
          if (e.target.id === 'sp-search') {
            spQuery = e.target.value
            const pos = e.target.selectionStart
            renderBody()
            const box = body.querySelector('#sp-search')
            box.focus()
            box.setSelectionRange(pos, pos)
          }
        },
        onKeydown(e) {
          if (tab === '179')
            return drill.onKeydown(e)
          if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229)
            return
          if (e.target.id === 'd-answer') {
            e.preventDefault()
            dSubmit()
          }
          else if (e.target.id === 'sp-answer') {
            e.preventDefault()
            spSubmit()
          }
        },
      })
    },
    render,
    leave,
    open(sub) {
      K.set('tab:listening', sub)
    },
  }
})()
