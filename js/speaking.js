/* 口语: Part 1 topics, Part 2 cue cards with 1 minute preparation and a 2 minute turn, Part 3
   follow-ups, pronunciation drills, and answer frames. Questions are read by the system voice.
   Answers can be recorded and played back; where the browser supports speech recognition a
   live transcript gives word count, speaking rate and filler words. Recordings stay in memory
   for this visit only; the stats and transcripts are saved. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const S = window.SPEAKING_DATA || { part1: [], part2: [], frames: [], phrases: [], pronunciation: [], criteria: [], fillers: [] }

  const TABS = [
    { value: 'p1', label: 'Part 1', icon: 'message-square-text' },
    { value: 'p2', label: 'Part 2 · 3', icon: 'mic' },
    { value: 'pron', label: '发音', icon: 'audio-lines' },
    { value: 'kit', label: '框架与评分', icon: 'book-open' },
  ]
  const PREP = 60
  const TALK = 120
  // "like" and "actually" are usually ordinary words, so they are not counted automatically.
  const FILLERS = S.fillers.filter(f => !['like', 'actually'].includes(f))

  let root = null
  let body = null
  let tab = 'p1'
  let flow = null // { part, id, stage, qi, prepAt }
  let rec = null // { handle, key, started, limit, autoStop, stopTick }
  let liveText = ''
  let stopPrep = null
  const takes = new Map()

  const history = () => K.get('spk', [])
  const words = t => (t ? t.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length : 0)
  const say = text => V.say(text, { rate: 0.95 })

  function fillersOf(t) {
    const lower = String(t || '').toLowerCase().replace(/[^a-z']+/g, ' ').trim()
    const out = []
    for (const f of FILLERS) {
      const n = (lower.match(new RegExp(`(?:^| )${f}(?= |$)`, 'g')) || []).length
      if (n)
        out.push([f, n])
    }
    return out
  }

  /* ---------- recording ---------- */

  function timerOnly() {
    const started = Date.now()
    return { transcribing: false, timerOnly: true, stop: async () => ({ url: '', type: '', transcript: '', secs: (Date.now() - started) / 1000 }) }
  }

  async function startRec(key, limit, label, autoStop) {
    if (rec)
      await stopRec()
    V.stopSpeech()
    let handle
    try {
      liveText = ''
      handle = K.canRecord()
        ? await K.record({
          transcribe: K.get('spk:transcribe', true),
          lang: V.store.settings.accent,
          onText: (t) => {
            liveText = t == null ? '' : t
            const box = body && body.querySelector('#sp-live')
            if (box)
              box.textContent = t == null ? '语音识别不可用，只录音' : t
          },
        })
        : timerOnly()
    }
    catch (e) {
      V.toast(e && e.name === 'NotAllowedError' ? '没有麦克风权限：请在浏览器设置里允许本网站使用麦克风' : '无法开始录音，改为只计时')
      handle = timerOnly()
    }
    rec = { handle, key, label, started: Date.now(), limit, autoStop }
    renderBody()
  }

  async function stopRec() {
    if (!rec)
      return
    const r = rec
    rec = null
    if (r.stopTick)
      r.stopTick()
    const out = await r.handle.stop()
    const prev = takes.get(r.key)
    if (prev && prev.url)
      URL.revokeObjectURL(prev.url)
    const n = words(out.transcript)
    const take = {
      url: out.url, type: out.type, secs: out.secs, transcript: out.transcript, words: n,
      wpm: n && out.secs >= 8 ? Math.round(n / (out.secs / 60)) : null,
      fillers: fillersOf(out.transcript), transcribed: r.handle.transcribing, timerOnly: !!r.handle.timerOnly,
    }
    takes.set(r.key, take)
    K.set('spk', history().concat({ at: Date.now(), key: r.key, label: r.label, secs: Math.round(out.secs), words: n, wpm: take.wpm, fillers: take.fillers.reduce((a, [, c]) => a + c, 0), transcript: out.transcript }).slice(-200))
    if (V.daily && /^p[12]:/.test(r.key))
      V.daily.mark('speak', 1)
    renderBody()
  }

  function judgeLength(secs, part) {
    if (part === 'p2')
      return secs < 90 ? ['warn', '不到 1 分半：考官会提示你继续说，尽量说满接近 2 分钟'] : ['ok', '接近 2 分钟']
    if (part === 'p3')
      return secs < 20 ? ['warn', '偏短：观点后面加理由和例子'] : ['ok', '']
    if (part === 'pron')
      return ['ok', '']
    return secs < 10 ? ['warn', '偏短：直接回答后加一个理由或细节'] : secs > 45 ? ['warn', '偏长：Part 1 每题 20–30 秒就够'] : ['ok', '']
  }

  function takeHtml(take, part) {
    const [lv, msg] = judgeLength(take.secs, part)
    const fill = take.fillers.map(([f, n]) => `<span class="chip" lang="en">${esc(f)} ×${n}</span>`).join('')
    return `<div class="sp-take">
      ${take.url ? `<audio controls preload="metadata" src="${take.url}"></audio>` : ''}
      <div class="w-stats"><span class="${lv === 'warn' ? 'warn' : ''}">时长 <b>${K.clock(take.secs)}</b>${msg ? ` · ${esc(msg)}` : ''}</span>
        ${take.transcribed ? `<span>识别到 <b>${take.words}</b> 词</span>${take.wpm ? `<span>约 <b>${take.wpm}</b> 词/分钟</span>` : ''}` : ''}</div>
      ${take.transcribed ? (take.transcript ? `<p class="sp-transcript" lang="en">${esc(take.transcript)}</p>` : '<p class="muted">没有识别到语音</p>') : `<p class="muted">${take.timerOnly ? '这个浏览器不能录音，只记录了时长。' : '这个浏览器不支持语音识别，可以回放录音自己检查。'}</p>`}
      ${fill ? `<div class="sp-fillers"><span class="label">口头禅</span><span class="chips">${fill}</span></div>` : ''}</div>`
  }

  function recBlock(key, part, limit, label, autoStop) {
    if (rec && rec.key === key) {
      return `<div class="sp-rec live"><button type="button" class="sp-recbtn on" data-act="sp-stop">${icon('square')}<span>停止</span></button>
        <span class="sh-timer">${icon('timer')}<span id="sp-rec-clock"></span></span>
        ${rec.handle.transcribing ? `<p id="sp-live" class="sp-live" lang="en" aria-live="polite">${esc(liveText)}</p>` : `<span class="muted">${rec.handle.timerOnly ? '只计时' : '录音中'}</span>`}</div>`
    }
    const take = takes.get(key)
    return `<div class="sp-rec"><button type="button" class="sp-recbtn" data-act="sp-rec" data-key="${esc(key)}" data-part="${part}" data-limit="${limit || 0}" data-label="${esc(label)}" data-auto="${autoStop ? 1 : 0}">${icon('mic')}<span>${take ? '重新录' : '录音回答'}</span></button>
      ${take ? takeHtml(take, part) : ''}</div>`
  }

  /* ---------- Part 1 ---------- */

  const countFor = prefix => history().filter(h => h.key.startsWith(prefix)).length

  function p1List() {
    return `${optionsHtml()}<ul class="sp-topics">${S.part1.map(t => `<li><button type="button" class="sp-topic" data-act="sp-p1" data-id="${t.id}">
      <b lang="en">${esc(t.topic)}</b><span class="muted">${esc(t.zh)} · ${t.q.length} 题${countFor(`p1:${t.id}:`) ? ` · 答过 ${countFor(`p1:${t.id}:`)} 次` : ''}</span></button></li>`).join('')}</ul>
      ${recentHtml('p1:')}`
  }

  function questionCard(text, playAct) {
    const hide = K.get('spk:hideq', false)
    return `<div class="sp-qcard"><button type="button" class="sd-play" data-act="${playAct}" title="听题" aria-label="听题">${icon('volume-2')}</button>
      <p class="sp-q${hide ? ' masked' : ''}" lang="en"${hide ? ' data-act="sp-peek" role="button" tabindex="0"' : ''}>${esc(text)}</p>
      <button type="button" class="icon-btn sm" data-act="sp-hideq" aria-pressed="${hide}" title="${hide ? '显示题目文字' : '只听不看'}" aria-label="${hide ? '显示题目文字' : '只听不看'}">${icon(hide ? 'eye-off' : 'eye')}</button></div>`
  }

  function p1Run() {
    const t = S.part1.find(x => x.id === flow.id)
    if (flow.stage === 'done') {
      const rows = t.q.map((q, i) => {
        const take = takes.get(`p1:${t.id}:${i}`)
        return `<li class="sp-sumrow"><p lang="en"><b>${i + 1}.</b> ${esc(q)}</p>${take ? takeHtml(take, 'p1') : '<span class="muted">没有作答</span>'}</li>`
      }).join('')
      return `<div class="sp-run"><div class="rd-bar"><button type="button" class="btn ghost" data-act="sp-back">${icon('chevron-left')}<span>话题列表</span></button><b lang="en">${esc(t.topic)}</b></div>
        <ul class="sp-sum">${rows}</ul>${critHtml()}
        <div class="sk-actions"><span class="spacer"></span><button type="button" class="btn" data-act="sp-p1" data-id="${t.id}">${icon('rotate-ccw')}<span>再答一遍</span></button></div></div>`
    }
    const q = t.q[flow.qi]
    const key = `p1:${t.id}:${flow.qi}`
    return `<div class="sp-run">
      <div class="rd-bar"><button type="button" class="btn ghost" data-act="sp-back">${icon('chevron-left')}<span>话题列表</span></button>
        <b lang="en">${esc(t.topic)}</b><span class="muted">${esc(t.zh)}</span><span class="spacer"></span><span class="muted">${flow.qi + 1} / ${t.q.length}</span></div>
      <div class="panel sp-stage">${questionCard(q, 'sp-sayq')}
        ${recBlock(key, 'p1', 0, `Part 1 · ${t.topic}`, false)}
        <div class="sk-actions"><button type="button" class="btn ghost" data-act="sp-prev"${flow.qi ? '' : ' disabled'}>${icon('chevron-left')}<span>上一题</span></button><span class="spacer"></span>
          <button type="button" class="btn primary" data-act="sp-next">${icon('arrow-right')}<span>${flow.qi < t.q.length - 1 ? '下一题' : '完成'}</span></button></div></div>
      <p class="sk-note">${icon('lightbulb')}<span>${esc((S.frames[0] || {}).tip || '')}</span></p></div>`
  }

  /* ---------- Part 2 and 3 ---------- */

  function p2List() {
    return `${optionsHtml()}<ul class="sp-topics">${S.part2.map(c => `<li><button type="button" class="sp-topic" data-act="sp-p2" data-id="${c.id}">
      <b lang="en">${esc(c.topic)}</b><span class="muted">${esc(c.zh)}${countFor(`p2:${c.id}:`) ? ` · 答过 ${countFor(`p2:${c.id}:`)} 次` : ''}</span></button></li>`).join('')}</ul>
      ${recentHtml('p2:')}`
  }

  function cueCard(c) {
    return `<div class="sp-cue" lang="en"><b>${esc(c.topic)}</b><span>You should say:</span><ul>${c.say.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`
  }

  function optionsHtml() {
    if (!K.canRecord())
      return `<p class="sk-note">${icon('info')}<span>这个浏览器不能录音，作答时只计时。</span></p>`
    return `<div class="sp-opts"><label class="sh-check"><input type="checkbox" data-act="sp-transcribe"${K.get('spk:transcribe', true) ? ' checked' : ''}${K.canTranscribe() ? '' : ' disabled'}><span>录音时实时转写${K.canTranscribe() ? '' : '（这个浏览器不支持）'}</span></label></div>`
  }

  function p2Run() {
    const c = S.part2.find(x => x.id === flow.id)
    const notes = K.get(`spk:notes:${c.id}`, '')
    const bar = `<div class="rd-bar"><button type="button" class="btn ghost" data-act="sp-back">${icon('chevron-left')}<span>题卡列表</span></button>
      <span class="muted">${esc(c.zh)}</span><span class="spacer"></span>
      ${V.seg('sp-stage', [{ value: 'prep', label: '准备' }, { value: 'talk', label: 'Part 2' }, { value: 'p3', label: 'Part 3' }], flow.stage === 'done' ? 'p3' : flow.stage)}</div>`
    if (flow.stage === 'prep') {
      return `<div class="sp-run">${bar}<div class="panel sp-stage">${cueCard(c)}
        <div class="sp-prep"><span class="sh-timer" title="准备时间">${icon('hourglass')}<span id="sp-prep-clock"></span></span><span class="muted">准备 1 分钟，只写关键词</span></div>
        <textarea id="sp-notes" class="text-area" rows="4" lang="en" spellcheck="false" autocapitalize="none" placeholder="notes">${esc(notes)}</textarea>
        <div class="sk-actions"><span class="spacer"></span><button type="button" class="btn primary lg" data-act="sp-talk">${icon('mic')}<span>开始说（2 分钟）</span></button></div></div>
        <p class="sk-note">${icon('lightbulb')}<span>${esc((S.frames[1] || {}).tip || '')}</span></p></div>`
    }
    if (flow.stage === 'talk') {
      return `<div class="sp-run">${bar}<div class="panel sp-stage">${cueCard(c)}
        ${notes ? `<div class="sp-notes-ro" lang="en">${esc(notes)}</div>` : ''}
        ${recBlock(`p2:${c.id}:talk`, 'p2', TALK, `Part 2 · ${c.zh}`, true)}
        <div class="sk-actions"><span class="spacer"></span><button type="button" class="btn${takes.get(`p2:${c.id}:talk`) ? ' primary' : ''}" data-act="sp-p3">${icon('arrow-right')}<span>进入 Part 3</span></button></div></div></div>`
    }
    const rows = c.part3.map((q, i) => `<li class="panel sp-stage">${questionCard(q, `sp-sayp3-${i}`)}${recBlock(`p2:${c.id}:p3:${i}`, 'p3', 0, `Part 3 · ${c.zh}`, false)}</li>`).join('')
    return `<div class="sp-run">${bar}<ul class="sp-p3">${rows}</ul>${critHtml()}
      <p class="sk-note">${icon('lightbulb')}<span>${esc((S.frames[2] || {}).tip || '')}</span></p></div>`
  }

  function startPrepClock() {
    if (stopPrep) {
      stopPrep()
      stopPrep = null
    }
    const el = body.querySelector('#sp-prep-clock')
    if (!el)
      return
    let warned = false
    stopPrep = K.ticker(el, flow.prepAt, PREP, (used) => {
      if (used >= PREP && !warned) {
        warned = true
        const btn = body.querySelector('[data-act="sp-talk"]')
        if (btn)
          btn.classList.add('pulse')
      }
    })
  }

  /* ---------- pronunciation ---------- */

  function compare(drill, transcript) {
    const said = new Set(String(transcript || '').toLowerCase().split(/[^a-z']+/).filter(Boolean))
    return drill.split(/\s+/).map((w) => {
      const n = w.toLowerCase().replace(/[^a-z']/g, '')
      return `<span class="${!n || said.has(n) ? 'pr-ok' : 'pr-miss'}">${esc(w)}</span>`
    }).join(' ')
  }

  function pronHtml() {
    return `<ul class="pr-list">${S.pronunciation.map((p, i) => {
      const take = takes.get(`pron:${i}`)
      return `<li class="panel pr-item"><div class="pr-head"><b>${esc(p.point)}</b></div><p>${esc(p.detail)}</p>
        <div class="pr-drill"><button type="button" class="icon-btn" data-act="sp-saypr" data-i="${i}" title="听示范" aria-label="听示范">${icon('volume-2')}</button><span lang="en">${esc(p.drill)}</span></div>
        ${recBlock(`pron:${i}`, 'pron', 20, `发音 · ${p.point}`, false)}
        ${take && take.transcribed && take.transcript ? `<div class="pr-cmp"><span class="label">识别对照</span><span lang="en">${compare(p.drill, take.transcript)}</span></div>` : ''}</li>`
    }).join('')}</ul>
    <p class="sk-note">${icon('info')}<span>识别对照只说明语音识别听出了哪些词。识别会自动纠错，没标红不代表发音完全准确，以回放录音、和示范对比为准。</span></p>`
  }

  /* ---------- frames and criteria ---------- */

  function critHtml() {
    return `<details class="sp-crit"><summary>${icon('list-checks')}<span>按评分标准自查</span></summary><div class="kit-grid">${S.criteria.map(c => `<div class="kit-card"><b>${esc(c.name)}</b><ul>${c.checks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div></details>`
  }

  function kitHtml() {
    return `<div class="kit">
      <h3 class="section-title">三个部分怎么答</h3>
      <div class="kit-grid">${S.frames.map(f => `<div class="kit-card"><b>${esc(f.part)}</b><span>${esc(f.tip)}</span><pre class="kit-example" lang="en">${esc(f.example)}</pre></div>`).join('')}</div>
      <h3 class="section-title">常用表达</h3>
      <div class="kit-grid">${S.phrases.map(g => `<div class="kit-card"><b>${esc(g.group)}</b><ul lang="en">${g.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      <h3 class="section-title">四项评分标准</h3>
      <div class="kit-grid">${S.criteria.map(c => `<div class="kit-card"><b>${esc(c.name)}</b><ul>${c.checks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      <h3 class="section-title">口头禅</h3><div class="chips">${S.fillers.map(f => `<span class="chip" lang="en">${esc(f)}</span>`).join('')}</div>
      <p class="sk-note">${icon('info')}<span>偶尔用 you know、I mean 很自然，问题在于频繁出现、代替了内容。用 Let me think 这类完整句子争取时间更好。</span></p>
      <div class="sk-actions"><a class="btn" href="https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf" target="_blank" rel="noopener">${icon('external-link')}<span>官方口语评分标准（PDF）</span></a></div></div>`
  }

  function recentHtml(prefix) {
    const list = history().filter(h => h.key.startsWith(prefix)).slice(-6).reverse()
    if (!list.length)
      return ''
    return `<h3 class="section-title">最近的回答</h3><ul class="sh-list">${list.map(h => `<li class="sh-hist"><span class="muted">${K.date(h.at)}</span><span>${esc(h.label)}</span><b>${K.clock(h.secs)}</b>
      ${h.words ? `<span class="muted">${h.words} 词${h.wpm ? ` · ${h.wpm} 词/分钟` : ''}</span>` : ''}${h.transcript ? `<span class="sp-hist-text" lang="en">${esc(h.transcript.slice(0, 120))}${h.transcript.length > 120 ? '…' : ''}</span>` : ''}</li>`).join('')}</ul>`
  }

  /* ---------- page ---------- */

  function renderBody() {
    if (!body)
      return
    if (stopPrep) {
      stopPrep()
      stopPrep = null
    }
    if (rec && rec.stopTick) {
      rec.stopTick()
      rec.stopTick = null
    }
    if (tab === 'pron')
      body.innerHTML = pronHtml()
    else if (tab === 'kit')
      body.innerHTML = kitHtml()
    else if (flow && flow.part === tab)
      body.innerHTML = tab === 'p1' ? p1Run() : p2Run()
    else
      body.innerHTML = tab === 'p1' ? p1List() : p2List()
    if (flow && flow.part === 'p2' && flow.stage === 'prep' && tab === 'p2')
      startPrepClock()
    const clock = body.querySelector('#sp-rec-clock')
    if (rec && clock) {
      const r = rec
      r.stopTick = K.ticker(clock, r.started, r.limit, (used) => {
        if (r.autoStop && r.limit && used >= r.limit && rec === r)
          stopRec()
      })
    }
  }

  function render() {
    tab = K.get('tab:speaking', 'p1')
    if (!TABS.some(x => x.value === tab))
      tab = 'p1'
    root.innerHTML = `<div class="skill">${K.head('口语', '', K.tabs(TABS, tab))}<div class="sk-body"></div></div>`
    body = root.querySelector('.sk-body')
    renderBody()
  }

  function leave() {
    if (rec)
      stopRec()
    V.stopSpeech()
  }

  async function onAct(name, el) {
    if (name.startsWith('sp-sayp3-')) {
      const c = S.part2.find(x => x.id === flow.id)
      return say(c.part3[Number(name.slice(9))])
    }
    switch (name) {
      case 'sub':
        if (rec)
          await stopRec()
        V.stopSpeech()
        K.set('tab:speaking', el.dataset.value)
        return render()
      case 'sp-p1':
        if (rec)
          await stopRec()
        flow = { part: 'p1', id: el.dataset.id, stage: 'q', qi: 0 }
        S.part1.find(x => x.id === el.dataset.id).q.forEach((_, i) => {
          const old = takes.get(`p1:${el.dataset.id}:${i}`)
          if (old && old.url)
            URL.revokeObjectURL(old.url)
          takes.delete(`p1:${el.dataset.id}:${i}`)
        })
        renderBody()
        return say(S.part1.find(x => x.id === flow.id).q[0])
      case 'sp-p2':
        if (rec)
          await stopRec()
        flow = { part: 'p2', id: el.dataset.id, stage: 'prep', prepAt: Date.now() }
        renderBody()
        return window.scrollTo(0, 0)
      case 'sp-back':
        if (rec)
          await stopRec()
        V.stopSpeech()
        flow = null
        return renderBody()
      case 'sp-sayq':
        return say(S.part1.find(x => x.id === flow.id).q[flow.qi])
      case 'sp-prev':
      case 'sp-next': {
        if (rec)
          await stopRec()
        const t = S.part1.find(x => x.id === flow.id)
        if (name === 'sp-next' && flow.qi >= t.q.length - 1) {
          flow.stage = 'done'
          V.stopSpeech()
          return renderBody()
        }
        flow.qi += name === 'sp-next' ? 1 : -1
        renderBody()
        return say(t.q[flow.qi])
      }
      case 'sp-talk': {
        flow.stage = 'talk'
        const c = S.part2.find(x => x.id === flow.id)
        return startRec(`p2:${c.id}:talk`, TALK, `Part 2 · ${c.zh}`, true)
      }
      case 'sp-p3':
        if (rec)
          await stopRec()
        flow.stage = 'p3'
        renderBody()
        return window.scrollTo(0, 0)
      case 'sp-rec':
        return startRec(el.dataset.key, Number(el.dataset.limit), el.dataset.label, el.dataset.auto === '1')
      case 'sp-stop':
        return stopRec()
      case 'sp-hideq':
        K.set('spk:hideq', !K.get('spk:hideq', false))
        return renderBody()
      case 'sp-peek':
        return el.classList.toggle('peeked')
      case 'sp-saypr':
        return say(S.pronunciation[Number(el.dataset.i)].drill)
    }
  }

  V.pages = V.pages || {}
  V.pages.speaking = {
    mount(el) {
      root = el
      K.wire(el, {
        onAct,
        async onSeg(name, value) {
          if (name === 'sp-stage' && flow) {
            if (rec)
              await stopRec()
            if (value === 'prep')
              flow.prepAt = Date.now()
            flow.stage = value
            renderBody()
          }
        },
        onInput(e) {
          if (e.target.id === 'sp-notes' && flow)
            K.set(`spk:notes:${flow.id}`, e.target.value)
        },
        onChange(e) {
          if (e.target.dataset.act === 'sp-transcribe')
            K.set('spk:transcribe', e.target.checked)
        },
      })
    },
    render,
    leave,
    open(sub) {
      K.set('tab:speaking', sub)
      flow = null
    },
  }
})()
