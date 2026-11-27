/* Daily listening / reading / writing / speaking tasks shown on the training home. Each page
   reports finished units with V.daily.mark(key, n); counts are kept per training day
   (the same day boundary as the vocabulary trainer). */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit

  const TASKS = [
    { key: 'l179', name: '听力 179 考点词', unit: '词', target: 10, page: 'listening', sub: '179', icon: 'headphones' },
    { key: 'dict', name: '信息听写', unit: '题', target: 10, page: 'listening', sub: 'info', icon: 'audio-lines' },
    { key: 'r538', name: '阅读 538 同义替换', unit: '词', target: 20, page: 'reading', sub: '538', icon: 'repeat' },
    { key: 'sent', name: '100 句翻译', unit: '句', target: 5, page: 'writing', sub: 'sent', icon: 'languages' },
    { key: 'tense', name: '时态语态', unit: '题', target: 20, page: 'writing', sub: 'tense', icon: 'clock' },
    { key: 'speak', name: '口语录音回答', unit: '题', target: 4, page: 'speaking', sub: 'p1', icon: 'mic' },
  ]
  const WEEKLY = [
    { key: 'read', name: '阅读模考', unit: '篇', target: 3, page: 'reading', sub: 'test' },
    { key: 'write', name: '作文', unit: '篇', target: 2, page: 'writing', sub: 'task2' },
  ]
  const ALL = TASKS.concat(WEEKLY)

  const dayStart = () => (V.trainer && V.trainer.cfg ? V.trainer.cfg().dayStart : undefined)
  const keyAt = t => V.scheduler.dayKey(t, dayStart())
  const today = () => keyAt(Date.now())
  const days = () => K.get('daily', {})

  function weekCount(key) {
    const all = days()
    let n = 0
    for (let i = 0; i < 7; i++)
      n += (all[keyAt(Date.now() - i * V.scheduler.DAY)] || {})[key] || 0
    return n
  }

  V.daily = {
    TASKS,
    count: key => (days()[today()] || {})[key] || 0,
    mark(key, n) {
      const all = days()
      const d = today()
      const rec = all[d] || {}
      const task = TASKS.find(t => t.key === key)
      const before = rec[key] || 0
      rec[key] = before + (n || 1)
      all[d] = rec
      // Keep about a month of history.
      const keep = Object.keys(all).sort().slice(-40)
      K.set('daily', Object.fromEntries(keep.map(k => [k, all[k]])))
      if (task && before < task.target && rec[key] >= task.target)
        V.toast(`今日${task.name}已完成`)
    },
    weekCount,
    panel() {
      const done = TASKS.filter(t => V.daily.count(t.key) >= t.target).length
      const rows = TASKS.map((t) => {
        const n = V.daily.count(t.key)
        const ok = n >= t.target
        return `<li class="dl-row${ok ? ' done' : ''}"><span class="dl-icon">${icon(ok ? 'circle-check' : t.icon)}</span>
          <span class="dl-name">${esc(t.name)}</span>
          <span class="sbar" role="img" aria-label="${n} / ${t.target}"><span class="b-mastered" style="width:${Math.min(100, (n / t.target) * 100)}%"></span></span>
          <span class="dl-n">${Math.min(n, 999)} / ${t.target} ${t.unit}</span>
          <button type="button" class="btn${ok ? ' ghost' : ''}" data-act="h-skill" data-key="${t.key}">${icon('arrow-right')}<span>${ok ? '再练' : '去练'}</span></button></li>`
      }).join('')
      const week = WEEKLY.map(t => `<button type="button" class="dl-week-item" data-act="h-skill" data-key="${t.key}"><span>${esc(t.name)}</span><b>${weekCount(t.key)}</b><small>/ ${t.target} ${t.unit}</small></button>`).join('')
      return `<div class="panel dl">
        <div class="dl-head"><b>今日听说读写</b><span class="muted">完成 ${done} / ${TASKS.length}</span><span class="spacer"></span><span class="muted">近 7 天</span>${week}</div>
        <ul class="dl-list">${rows}</ul></div>`
    },
    go(key) {
      const t = ALL.find(x => x.key === key)
      if (!t)
        return
      const page = V.pages && V.pages[t.page]
      if (page && page.open)
        page.open(t.sub)
      V.go(t.page)
    },
  }
})()
