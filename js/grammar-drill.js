/* 写作 · 时态语态: high-volume drills of the 7 tenses in active and passive voice, plus be.
   Six item types; a wrong item comes back after three others and a fresh one of the same
   form follows later. Accuracy is kept per form, and weak forms come up more often. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const G = V.grammarGen
  const DATA = G.load(window.GRAMMAR_DATA)
  const RUN = 20
  const MASTER_N = 10

  let run = null // { items, pos, res, typed, first: Map(form -> ok), retried: Set, hinted }
  let showTable = false

  const stats = () => K.get('gstats', { forms: {}, types: {} })
  const prefs = () => K.get('gprefs', { types: [], tenses: [], voice: '' })
  const lastAcc = s => (s && s.last && s.last.length ? s.last.filter(Boolean).length / s.last.length : null)
  const state = (s) => {
    if (!s || !s.n)
      return 'new'
    const a = lastAcc(s)
    return s.n >= MASTER_N && a >= 0.9 ? 'ok' : a < 0.7 ? 'weak' : 'learning'
  }
  const STATE = { new: '未练', learning: '练习中', weak: '薄弱', ok: '已掌握' }

  function record(item, ok) {
    const st = stats()
    const f = Object.assign({ n: 0, ok: 0, last: [] }, st.forms[item.form])
    f.n++
    if (ok)
      f.ok++
    f.last = f.last.concat(ok).slice(-12)
    f.at = Date.now()
    st.forms[item.form] = f
    const t = Object.assign({ n: 0, ok: 0 }, st.types[item.type])
    t.n++
    if (ok)
      t.ok++
    st.types[item.type] = t
    K.set('gstats', st)
    if (V.daily)
      V.daily.mark('tense', 1)
  }

  function formsFor(p) {
    return G.FORMS.filter(f => (!p.tenses.length || p.tenses.includes(f.t)) && (!p.voice || f.v === p.voice)).map(f => f.id)
  }

  function start(opts) {
    const p = prefs()
    let forms = opts.forms || formsFor(p)
    if (opts.weak) {
      const st = stats().forms
      const weak = G.FORMS.map(f => f.id).filter(id => state(st[id]) === 'weak' || state(st[id]) === 'learning')
      forms = weak.length ? weak : forms
    }
    const items = G.plan(DATA, { n: opts.n || RUN, forms, types: opts.types || p.types, stats: stats().forms })
    if (!items.length)
      return V.toast('所选题型和范围没有可出的题，换一个组合')
    run = { items, pos: 0, res: null, typed: '', first: new Map(), retried: new Set(), hinted: false, firstOk: 0, prev: null }
  }

  function submit(answer) {
    const item = run.items[run.pos]
    const val = String(answer == null ? '' : answer).trim()
    if (!val)
      return false
    const res = G.judge(item, val)
    const ok = res.ok && !run.hinted
    run.typed = val
    run.res = Object.assign(res, { hinted: run.hinted && res.ok })
    record(item, ok)
    const key = item
    if (!run.first.has(key)) {
      run.first.set(key, ok)
      if (ok)
        run.firstOk++
    }
    if (!ok && !run.retried.has(key)) {
      run.retried.add(key)
      const again = Object.assign({}, item, { retry: true })
      run.first.set(again, true) // retries are not counted as first attempts
      run.items.splice(Math.min(run.items.length, run.pos + 4), 0, again)
      const fresh = G.plan(DATA, { n: 1, forms: [item.form], types: [item.type] })[0]
      if (fresh)
        run.items.splice(Math.min(run.items.length, run.pos + 10), 0, fresh)
    }
    return true
  }

  // A correct answer moves on at once; a wrong one stays so the explanation can be read.
  function afterSubmit(body) {
    if (run.res.ok && !run.res.hinted) {
      run.prev = { expect: run.res.expect }
      return act('g-next', null, body, true)
    }
    run.prev = null
    render(body)
  }

  /* ---------- views ---------- */

  function cell(id, st) {
    const f = G.FORM[id]
    const s = st[id]
    const a = lastAcc(s)
    const k = state(s)
    return `<button type="button" class="gd-cell ${k}" data-act="g-form" data-id="${id}" title="只练 ${esc(f.name)}">
      <span class="gd-pat" lang="en">${esc(f.pat)}</span>
      <span class="sbar"><span class="b-mastered" style="width:${a == null ? 0 : Math.round(a * 100)}%"></span></span>
      <span class="gd-acc">${a == null ? STATE.new : `${Math.round(a * 100)}% · ${s.n} 题`}</span></button>`
  }

  function matrixHtml() {
    const st = stats().forms
    const rows = G.TENSES.map((t) => {
      const ids = G.FORMS.filter(f => f.t === t.t)
      const be = ids.find(f => f.v === 'be')
      const act = ids.find(f => f.v === 'act')
      const pass = ids.find(f => f.v === 'pass')
      return `<div class="gd-row"><b class="gd-tense">${esc(t.name)}</b>
        ${be ? cell(be.id, st) : '<span class="gd-cell blank"></span>'}${cell(act.id, st)}${cell(pass.id, st)}</div>`
    }).join('')
    return `<div class="gd-matrix"><div class="gd-row gd-headrow"><span></span><span>be 动词</span><span>主动</span><span>被动</span></div>${rows}</div>`
  }

  function tableHtml() {
    const sc = DATA.scenes[0]
    const rows = G.TENSES.map((t) => {
      const ids = G.FORMS.filter(f => f.t === t.t)
      const m = DATA.markers[t.t]
      const ex = ids.filter(f => f.v !== 'be').map((f) => {
        const p = G.parts(f.id, sc, false, m[0], false)
        const n = G.parts(f.id, sc, true, m[0], false)
        return `<div class="gd-ex"><span class="tag">${f.v === 'act' ? '主动' : '被动'}</span><span lang="en"><b>${esc(f.pat)}</b><br>${esc(G.statement(p))}<br>${esc(G.statement(n))}<br>${esc(G.question(f.id, p, sc))}</span></div>`
      }).join('')
      const be = ids.find(f => f.v === 'be')
      const beEx = be ? (() => {
        const b = DATA.be[0]
        const mk = DATA.markers[t.t === 'pres' ? 'beP' : 'beS'][0]
        const p = G.parts(be.id, b, false, mk)
        return `<div class="gd-ex"><span class="tag">be</span><span lang="en"><b>${esc(be.pat)}</b><br>${esc(G.statement(p))}<br>${esc(G.question(be.id, p, b))}</span></div>`
      })() : ''
      return `<li class="gd-tref"><div class="gd-tref-head"><b>${esc(t.name)}</b><span class="muted" lang="en">${m.map(x => esc(x.en)).join(' · ')}</span></div>
        <div class="gd-exs">${beEx}${ex}</div><p class="muted">${esc(ids.filter(f => f.v !== 'be').map(f => f.rule).join(' '))}</p></li>`
    }).join('')
    return `<ul class="gd-tlist">${rows}</ul>`
  }

  function homeHtml() {
    const p = prefs()
    const st = stats()
    const total = Object.values(st.forms).reduce((s, f) => s + f.n, 0)
    const ok = Object.values(st.forms).reduce((s, f) => s + f.ok, 0)
    const weakN = G.FORMS.filter(f => ['weak', 'learning'].includes(state(st.forms[f.id]))).length
    const masterN = G.FORMS.filter(f => state(st.forms[f.id]) === 'ok').length
    const chip = (kind, v, label, on) => `<button type="button" class="chip-btn" data-act="g-pref" data-kind="${kind}" data-v="${v}" aria-pressed="${on}">${esc(label)}</button>`
    const sum = run && run.pos >= run.items.length ? (() => {
      const firsts = [...run.first.entries()].filter(([it]) => !it.retry)
      const byForm = new Map()
      for (const [it, good] of firsts) {
        const x = byForm.get(it.form) || [0, 0]
        x[0] += good ? 1 : 0
        x[1]++
        byForm.set(it.form, x)
      }
      const weak = [...byForm].filter(([, x]) => x[0] < x[1]).map(([f]) => G.FORM[f].name)
      return `<div class="panel sd-sum-box"><div class="sd-sum-score"><b>${run.firstOk}</b><span>/ ${firsts.length}</span></div><div><b>本组完成</b><div class="muted">第一次就答对 ${run.firstOk} 题${weak.length ? `；要再练：${weak.map(esc).join('、')}` : '，全部一次答对'}</div></div></div>`
    })() : ''
    return `<div class="gd-home">${sum}
      <div class="panel gd-start">
        <div class="gd-opts"><span class="label">题型</span>${G.TYPES.map(t => chip('types', t.id, t.name, p.types.includes(t.id))).join('')}</div>
        <div class="gd-opts"><span class="label">时态</span>${G.TENSES.map(t => chip('tenses', t.t, t.name, p.tenses.includes(t.t))).join('')}</div>
        <div class="gd-opts"><span class="label">语态</span>${chip('voice', 'act', '只练主动', p.voice === 'act')}${chip('voice', 'pass', '只练被动', p.voice === 'pass')}${chip('voice', 'be', '只练 be', p.voice === 'be')}</div>
        <div class="sk-actions"><span class="muted">不选表示全部 · 累计 ${total} 题 · 正确率 ${K.pct(ok, total)} · 已掌握 ${masterN} / ${G.FORMS.length}</span><span class="spacer"></span>
          <button type="button" class="btn" data-act="g-start" data-weak="1"${weakN ? '' : ' disabled'}>${icon('flame')}<span>薄弱项</span></button>
          <button type="button" class="btn primary" data-act="g-start">${icon('play')}<span>开始 ${RUN} 题</span></button></div></div>
      <h3 class="section-title">十六种形式 <span class="muted">点格子只练这一种</span></h3>${matrixHtml()}
      <div class="sk-actions"><button type="button" class="btn ghost" data-act="g-table" aria-pressed="${showTable}">${icon('list-ordered')}<span>${showTable ? '收起结构表' : '结构与例句'}</span></button></div>
      ${showTable ? tableHtml() : ''}
      <p class="sk-note">${icon('info')}<span>“已掌握”= 练满 ${MASTER_N} 题且最近的正确率不低于 90%。答错的题隔 3 题再做一次，之后还会出一道同类新题；用了“看规则”的题不算独立答对。</span></p></div>`
  }

  function optionsHtml(item) {
    return `<div class="gd-ids">${G.TENSES.map((t) => {
      const ids = G.FORMS.filter(f => f.t === t.t)
      return `<div class="gd-idrow"><b>${esc(t.name)}</b>${ids.map(f => `<button type="button" class="btn gd-idbtn${run.res && f.id === item.form ? ' right' : ''}${run.res && run.typed === f.id && f.id !== item.form ? ' wrong' : ''}" data-act="g-pick" data-id="${f.id}"${run.res ? ' disabled' : ''}>${f.v === 'be' ? 'be' : f.v === 'act' ? '主动' : '被动'}</button>`).join('')}</div>`
    }).join('')}</div>`
  }

  function runHtml() {
    const item = run.items[run.pos]
    const res = run.res
    const f = G.FORM[item.form]
    const sentence = item.type !== 'fill'
    const input = item.type === 'id' ? optionsHtml(item)
      : `<input id="g-answer" class="text-input gd-input${sentence ? ' wide' : ''}" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="${sentence ? 'sentences' : 'off'}" spellcheck="false" value="${esc(run.typed)}" placeholder="${sentence ? '写出整句' : '填动词部分'}"${res ? ' readonly' : ''}>`
    const fb = res ? `<div class="sd-fb ${res.ok ? (res.hinted ? 'is-close' : 'is-right') : 'is-wrong'}">
        <div class="sd-fb-row"><b>${res.ok ? (res.hinted ? '对了（看过规则，不算独立答对）' : '正确') : '不对'}</b></div>
        ${res.ok ? '' : `<div class="sd-fb-row"><span class="label">答案</span><b lang="en">${esc(res.expect)}</b></div>`}
        ${item.why && !res.ok ? `<div class="sd-fb-row"><span class="label">原句错在</span><span>${esc(item.why)}</span></div>` : ''}
        ${res.notes.length ? res.notes.map(n => `<div class="sd-fb-row"><span class="label">说明</span><span>${esc(n)}</span></div>`).join('') : ''}
        <div class="sd-fb-row muted"><span class="label">形式</span><span>${esc(f.name)}：<span lang="en">${esc(f.pat)}</span></span></div></div>` : ''
    return `<div class="gd-run sd-run">
      <div class="sd-top"><span class="tag">${esc(G.TYPES.find(t => t.id === item.type).name)}</span>${item.retry ? '<span class="tag warn">再做一次</span>' : ''}
        <span class="muted sd-count">${run.pos + 1} / ${run.items.length}</span><span class="spacer"></span>
        <button type="button" class="btn ghost" data-act="g-quit">${icon('x')}<span>结束</span></button></div>
      ${run.prev && !res ? `<div class="gd-prev">${icon('circle-check')}<span>上一题正确：<span lang="en">${esc(run.prev.expect)}</span></span></div>` : ''}
      <div class="sd-q panel">
        <p class="gd-task">${esc(item.task)}</p>
        <p class="gd-prompt"${item.type === 'zh' ? '' : ' lang="en"'}>${esc(item.prompt)}</p>
        ${item.chips ? `<div class="chips gd-chips">${item.chips.map(c => `<span class="chip" lang="en">${esc(c)}</span>`).join('')}</div>` : ''}
        ${run.hinted && !res ? `<p class="gd-rule">${esc(f.name)}：<b lang="en">${esc(f.pat)}</b>。${esc(f.rule)}</p>` : ''}
        ${input}${fb}
        <div class="sk-actions"><span class="spacer"></span>
          ${res ? `<button type="button" class="btn primary" data-act="g-next">${icon('arrow-right')}<span>下一题</span></button>`
            : `${item.type === 'id' ? '' : `<button type="button" class="btn ghost" data-act="g-hint"${run.hinted ? ' disabled' : ''}>${icon('lightbulb')}<span>看规则</span></button>
               <button type="button" class="btn primary" data-act="g-check">${icon('send')}<span>提交</span></button>`}`}</div></div></div>`
  }

  function render(body) {
    body.innerHTML = run && run.pos < run.items.length ? runHtml() : homeHtml()
    const inp = body.querySelector('#g-answer')
    if (inp && !run.res)
      inp.focus({ preventScroll: true })
    else if (run && run.res) {
      const nx = body.querySelector('[data-act="g-next"]')
      if (nx)
        nx.focus({ preventScroll: true })
    }
  }

  function act(name, el, body, keepPrev) {
    switch (name) {
      case 'g-pref': {
        const p = prefs()
        const { kind, v } = el.dataset
        if (kind === 'voice')
          p.voice = p.voice === v ? '' : v
        else
          p[kind] = p[kind].includes(v) ? p[kind].filter(x => x !== v) : p[kind].concat(v)
        K.set('gprefs', p)
        return render(body)
      }
      case 'g-start':
        start({ weak: el.dataset.weak === '1' })
        return render(body)
      case 'g-form':
        start({ forms: [el.dataset.id], types: [] })
        return render(body)
      case 'g-table':
        showTable = !showTable
        return render(body)
      case 'g-hint':
        run.typed = (body.querySelector('#g-answer') || {}).value || ''
        run.hinted = true
        return render(body)
      case 'g-check': {
        const inp = body.querySelector('#g-answer')
        if (submit(inp ? inp.value : ''))
          afterSubmit(body)
        else if (inp)
          inp.focus()
        return
      }
      case 'g-pick':
        if (submit(el.dataset.id))
          afterSubmit(body)
        return
      case 'g-next':
        run.pos++
        run.res = null
        run.typed = ''
        run.hinted = false
        if (!keepPrev)
          run.prev = null
        return render(body)
      case 'g-quit':
        run = null
        return render(body)
    }
  }

  function onKeydown(e, body) {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || !run)
      return
    if (e.target.id === 'g-answer') {
      e.preventDefault()
      act(run.res ? 'g-next' : 'g-check', e.target, body)
    }
  }

  // current(): the item on screen (used by the browser tests).
  V.grammarDrill = { render, act, onKeydown, current: () => (run && run.pos < run.items.length ? run.items[run.pos] : null) }
})()
