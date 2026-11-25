/* Offline writing check for IELTS Task 1 / Task 2 / letters: counts, sentence variety,
   linking devices, repetition, register and common learner patterns.
   It points at things worth checking; it does not estimate a band score. Pure functions. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).writingCheck = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  const LINKERS = {
    递进: ['in addition', 'additionally', 'furthermore', 'moreover', 'what is more', 'besides', 'also', 'as well as'],
    转折: ['however', 'nevertheless', 'nonetheless', 'on the other hand', 'in contrast', 'by contrast', 'whereas', 'while', 'yet', 'on the contrary', 'but'],
    因果: ['therefore', 'thus', 'consequently', 'as a result', 'as a consequence', 'because', 'because of', 'due to', 'since', 'this means that', 'hence', 'so that'],
    举例: ['for example', 'for instance', 'such as', 'to illustrate', 'in particular', 'a case in point'],
    让步: ['although', 'even though', 'though', 'despite', 'in spite of', 'admittedly', 'while it is true'],
    顺序: ['firstly', 'first of all', 'secondly', 'thirdly', 'finally', 'lastly', 'to begin with', 'subsequently'],
    总结: ['in conclusion', 'to conclude', 'to sum up', 'in summary', 'overall', 'all in all'],
  }

  // General words that learners tend to repeat, with replacements that fit most academic contexts.
  const SUGGEST = {
    important: ['significant', 'crucial', 'essential', 'vital'],
    good: ['beneficial', 'positive', 'valuable', 'effective'],
    bad: ['harmful', 'negative', 'damaging', 'detrimental'],
    big: ['large', 'substantial', 'considerable', 'major'],
    problem: ['issue', 'challenge', 'difficulty', 'concern'],
    people: ['individuals', 'citizens', 'the public', 'residents'],
    think: ['believe', 'argue', 'consider', 'maintain'],
    show: ['indicate', 'illustrate', 'reveal', 'demonstrate'],
    increase: ['rise', 'growth', 'grow', 'climb'],
    decrease: ['fall', 'decline', 'drop', 'reduction'],
    many: ['numerous', 'a large number of', 'a great many', 'countless'],
    very: ['（换用更强的形容词：very big → enormous，very important → crucial）'],
    change: ['shift', 'alter', 'transformation', 'modify'],
    help: ['assist', 'support', 'enable', 'benefit'],
    use: ['employ', 'make use of', 'rely on', 'utilise'],
    get: ['obtain', 'gain', 'receive', 'acquire'],
    thing: ['aspect', 'factor', 'issue', 'element'],
    way: ['method', 'approach', 'means', 'strategy'],
    affect: ['influence', 'have an impact on', 'shape'],
    benefit: ['advantage', 'merit', 'gain'],
    reduce: ['cut', 'lower', 'decrease', 'limit'],
    money: ['funding', 'resources', 'finance', 'expenditure'],
    country: ['nation', 'state', 'society'],
    child: ['young people', 'the young', 'minors'],
    say: ['claim', 'state', 'suggest', 'point out'],
    make: ['create', 'produce', 'cause', 'generate'],
    lot: ['a great deal of', 'a considerable amount of', 'numerous'],
    job: ['employment', 'occupation', 'career', 'post'],
    easy: ['straightforward', 'simple', 'convenient'],
    hard: ['difficult', 'challenging', 'demanding'],
  }

  const STOP = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being am do does did have has had '
    + 'this that these those it its they them their there here he she his her we our us you your i me my mine not no nor so than too can could '
    + 'will would shall should may might must also more most much such which who whom whose what when where why how all any each few other some '
    + 'into over under about after before between during through up down out off again further then once only own same just both very s t '
    + 'one two three four five six seven eight nine ten per cent percent while whereas however because since although though over than')
    .split(/\s+/))

  const PATTERNS = [
    { kind: 'grammar', re: /\balthough\b[^.!?]*,\s*but\b/gi, why: 'although 和 but 不能同时用。', fix: '删掉 but' },
    { kind: 'grammar', re: /\blead(?:s|ing)? to (?:increase|decrease|improve|reduce|make|become|cause|rise|grow|have)\b/gi, why: 'lead to 后接名词：lead to an increase in ...', fix: 'lead to + 名词' },
    { kind: 'grammar', re: /\bin my (?:opinion|view),?\s+i (?:think|believe)\b/gi, why: 'In my opinion 和 I think 重复。', fix: '保留一个' },
    { kind: 'grammar', re: /\bpeople is\b/gi, why: 'people 是复数。', fix: 'people are' },
    { kind: 'grammar', re: /\bdiscuss(?:es|ed|ing)? about\b/gi, why: 'discuss 是及物动词，不加 about。', fix: 'discuss sth' },
    { kind: 'grammar', re: /\bmak(?:e|es|ing) (?:\w+ ){1,2}to (?:do|be|have|go|work|study|feel|become|think|learn|spend)\b/gi, why: 'make sb do，不带 to。', fix: 'make sb do' },
    { kind: 'grammar', re: /\baccording to my (?:opinion|view)\b/gi, why: 'according to 不和 my opinion 连用。', fix: 'In my opinion' },
    { kind: 'grammar', re: /\bthe society\b/gi, why: '泛指“社会”时 society 一般不加 the。', fix: 'society' },
    { kind: 'grammar', re: /\b(?:a|one) (?:informations|advices|equipments|knowledges|researches)\b|\b(?:informations|advices|equipments|knowledges|furnitures)\b/gi, why: '这些是不可数名词，没有复数形式。', fix: 'information / advice / equipment / knowledge' },
    { kind: 'grammar', re: /\bmore and more\b/gi, why: 'more and more 很常见，用两次以上显得单调。', fix: 'an increasing number of / growing', minCount: 2 },
    { kind: 'style', re: /\bwith the (?:rapid )?development of (?:society|economy|the economy|technology|science)\b/gi, why: '万能开头没有信息量，考官会认为是背诵内容。', fix: '直接写具体原因' },
    { kind: 'style', re: /\bevery coin has two sides\b|\bhas its pros and cons\b|\ba double-edged sword\b/gi, why: '套话不加分，直接写出具体利弊。', fix: '写具体内容' },
    { kind: 'register', re: /\b(?:a lot of|lots of)\b/gi, why: '偏口语。', fix: 'a large number of / a great deal of / many / much' },
    { kind: 'register', re: /\b(?:kids?|stuff|guys|gonna|wanna|kinda|okay|ok)\b/gi, why: '口语化用词。', fix: 'children / things → 具体名词' },
    { kind: 'register', re: /\b(?:etc\.?|and so on)\b/gi, why: '列举不完整，显得没有想清楚。', fix: 'such as ...（举两三个具体例子）' },
    { kind: 'register', re: /\b(?:really|totally|super|pretty much)\b/gi, why: '口语化的程度副词。', fix: 'significantly / extremely，或删掉' },
    { kind: 'register', re: /!/g, why: '学术写作一般不用感叹号。', fix: '改成句号' },
  ]
  const CONTRACTION = /\b(?:don't|can't|won't|isn't|aren't|doesn't|didn't|it's|that's|there's|i'm|they're|we're|you're|shouldn't|wouldn't|couldn't|haven't|hasn't|let's|i've|we've|they've|i'd|we'll|they'll)\b/gi

  /* ---------- tokenising ---------- */

  const clean = s => String(s || '').replace(/\r\n?/g, '\n').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"')

  /** IELTS-style word count: every space-separated token with a letter or digit. */
  function countWords(text) {
    return clean(text).split(/\s+/).filter(t => /[A-Za-z0-9]/.test(t)).length
  }

  function sentences(text) {
    const protectedText = clean(text).replace(/\b(e\.g|i\.e|etc|Mr|Mrs|Ms|Dr|vs|approx)\./gi, m => m.replace(/\./g, '\u0001'))
    // No lookbehind: iPadOS Safari before 16.4 cannot parse it.
    return protectedText.replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(s => s.replace(/\u0001/g, '.').trim()).filter(s => /[A-Za-z]/.test(s))
  }

  function paragraphs(text) {
    return clean(text).split(/\n+/).map(p => p.trim()).filter(p => /[A-Za-z]/.test(p))
  }

  function lemma(w) {
    if (w.length > 4 && /ies$/.test(w))
      return `${w.slice(0, -3)}y`
    if (w === 'children')
      return 'child'
    if (w === 'people')
      return w
    if (w.length > 3 && /[^s]s$/.test(w) && !/(ous|ss|is|us)$/.test(w))
      return w.slice(0, -1)
    return w
  }

  const tokens = text => (clean(text).toLowerCase().match(/[a-z]+(?:[-'][a-z]+)*/g) || [])

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /* ---------- checks ---------- */

  function findLinkers(text, sents) {
    const lower = ` ${clean(text).toLowerCase().replace(/\s+/g, ' ')} `
    const found = []
    for (const [fn, list] of Object.entries(LINKERS)) {
      for (const l of list) {
        const n = (lower.match(new RegExp(`(?:^|[^a-z])${escapeRe(l)}(?![a-z])`, 'g')) || []).length
        if (n)
          found.push({ fn, word: l, count: n })
      }
    }
    // Sentences that open with a linking word or phrase.
    const openers = sents.filter((s) => {
      const head = s.toLowerCase()
      return Object.values(LINKERS).some(list => list.some(l => head.startsWith(`${l},`) || head.startsWith(`${l} `)))
    }).length
    return { found: found.sort((a, b) => b.count - a.count), openers }
  }

  function findRepeats(text, promptText, synonyms) {
    const counts = new Map()
    for (const t of tokens(text)) {
      if (STOP.has(t) || t.length < 3)
        continue
      const l = lemma(t)
      const e = counts.get(l) || { word: l, count: 0, forms: new Map() }
      e.count++
      e.forms.set(t, (e.forms.get(t) || 0) + 1)
      counts.set(l, e)
    }
    const topic = new Set(tokens(promptText).map(lemma))
    const out = []
    for (const e of counts.values()) {
      // Words from the question may repeat more: they name the topic.
      const limit = topic.has(e.word) ? (SUGGEST[e.word] ? 5 : 7) : SUGGEST[e.word] ? 3 : 5
      if (e.count < limit)
        continue
      const form = [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const fromBook = synonyms && (synonyms.get(e.word) || synonyms.get(form))
      out.push({ word: form, count: e.count, topic: topic.has(e.word), suggest: SUGGEST[e.word] || [], book: fromBook || [] })
    }
    return out.sort((a, b) => b.count - a.count).slice(0, 10)
  }

  function findPatterns(text, task) {
    const out = []
    const src = clean(text)
    for (const p of PATTERNS) {
      if (task === 'letter-informal' && p.kind === 'register')
        continue
      const hits = src.match(p.re) || []
      if (hits.length >= (p.minCount || 1))
        out.push({ kind: p.kind, hits: [...new Set(hits.map(h => h.trim()))].slice(0, 4), count: hits.length, why: p.why, fix: p.fix })
    }
    if (task !== 'letter-informal') {
      const c = src.match(CONTRACTION) || []
      if (c.length)
        out.push({ kind: 'register', hits: [...new Set(c)].slice(0, 4), count: c.length, why: '正式写作不用缩写。', fix: 'do not / it is ...' })
    }
    if (task === 't1' || task === 't2') {
      const you = src.match(/\b(?:you|your|yourself)\b/gi) || []
      if (you.length)
        out.push({ kind: 'register', hits: [...new Set(you.map(x => x.toLowerCase()))], count: you.length, why: '泛指的 you 偏口语。', fix: 'people / individuals / one' })
    }
    if (task === 't1') {
      const me = src.match(/\b(?:I|my|me|I think|in my opinion)\b/g) || []
      if (me.length)
        out.push({ kind: 'task', hits: [...new Set(me)], count: me.length, why: '小作文只描述数据，不写个人观点。', fix: '删去个人看法' })
    }
    return out
  }

  /** British forms and American forms used in the same text (from the my-ielts spelling table). */
  function spellingMix(text, rows) {
    const words = new Set(tokens(text))
    const uk = []
    const us = []
    for (const r of rows || []) {
      const ukOnly = r.uk.filter(f => !r.us.includes(f))
      const usOnly = r.us.filter(f => !r.uk.includes(f))
      for (const f of ukOnly) {
        if (words.has(f.toLowerCase()))
          uk.push(f)
      }
      for (const f of usOnly) {
        if (words.has(f.toLowerCase()))
          us.push(f)
      }
    }
    return uk.length && us.length ? { uk, us } : null
  }

  /**
   * Analyse a response.
   * opts: { task: 't1' | 't2' | 'letter-formal' | 'letter-informal', prompt, min, synonyms: Map, spelling: rows }
   */
  function analyze(text, opts = {}) {
    const task = opts.task || 't2'
    const min = opts.min || (task === 't2' ? 250 : 150)
    const sents = sentences(text)
    const paras = paragraphs(text)
    const lens = sents.map(countWords)
    const words = countWords(text)
    const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0
    const sd = lens.length ? Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length) : 0
    const linkers = findLinkers(text, sents)
    const lower = clean(text).toLowerCase()
    const res = {
      words, min, short: words < min,
      paragraphs: paras.length,
      sentences: sents.length,
      avgLen: Math.round(avg * 10) / 10,
      spread: Math.round(sd * 10) / 10,
      longest: lens.length ? Math.max(...lens) : 0,
      long: sents.filter((s, i) => lens[i] > 40).map(s => s.slice(0, 80)),
      unique: (() => {
        const t = tokens(text)
        return t.length ? Math.round((new Set(t.map(lemma)).size / t.length) * 100) : 0
      })(),
      linkers: linkers.found,
      openers: linkers.openers,
      overused: linkers.found.filter(l => l.count >= 3 && !['also', 'but', 'because', 'while', 'such as', 'as well as'].includes(l.word)),
      repeats: findRepeats(text, opts.prompt || '', opts.synonyms),
      patterns: findPatterns(text, task),
      mix: spellingMix(text, opts.spelling),
      checks: [],
    }
    const add = (ok, label, detail) => res.checks.push({ ok, label, detail })
    add(!res.short, `字数 ${words} / 至少 ${min}`, res.short ? '字数不足会直接影响任务完成度的分数。' : '')
    if (task === 't2') {
      add(paras.length >= 4 && paras.length <= 6, `段落 ${paras.length}`, '常见结构：开头 + 2–3 个主体段 + 结尾（每段之间换行）。')
      const first = (paras[0] || '').toLowerCase()
      const last = (paras[paras.length - 1] || '').toLowerCase()
      const stance = /\b(i (?:strongly |partly |largely |completely )?(?:agree|disagree|believe|would argue|am convinced)|in my (?:view|opinion)|this essay (?:will )?(?:argue|agree|disagree)|to a (?:large|certain|great) extent|outweigh)/
      add(stance.test(first) && stance.test(last), '开头和结尾都表明了立场', '考官要求立场清楚且前后一致。讨论类和利弊类同样需要你的判断。')
    }
    if (task === 't1') {
      add(/\b(overall|in general|it is (?:clear|evident|noticeable) that|the most (?:striking|noticeable|significant) (?:feature|trend|change))\b/.test(lower), '有总体概述（overview）', '没有概述，任务完成度一般很难超过 5 分。')
      add((clean(text).match(/\d/g) || []).length >= 6, '引用了具体数据', '主要特征要配上数据支持。')
    }
    if (task.startsWith('letter')) {
      const greet = clean(text).match(/^\s*dear\s+([^\n,]*)/i)
      add(!!greet, '有称呼（Dear ...）', '书信要以 Dear ... 开头。')
      const formalOpen = greet && /sir|madam/i.test(greet[1])
      const sign = /\byours faithfully\b/i.test(text) ? 'faithfully' : /\byours sincerely\b/i.test(text) ? 'sincerely' : /\b(best wishes|all the best|take care|love|cheers|best regards|kind regards|regards)\b/i.test(text) ? 'informal' : ''
      if (task === 'letter-formal')
        add(formalOpen ? sign === 'faithfully' : sign === 'sincerely' || sign === 'faithfully', '结尾敬语与称呼匹配', 'Dear Sir or Madam → Yours faithfully；Dear Mr Smith → Yours sincerely。')
      else
        add(!!sign, '有结尾（Best wishes 等）', '非正式信件常用 Best wishes / All the best。')
    }
    add(sents.length < 3 || res.spread >= 4, `句子长短有变化（平均 ${res.avgLen} 词）`, '长短句搭配更好读；全部是短句或全部是长句都需要调整。')
    add(!res.overused.length, '连接词没有重复堆砌', res.overused.map(l => `${l.word} ×${l.count}`).join('，'))
    add(!sents.length || res.openers / sents.length <= 0.6, '句首连接词比例正常', '大多数句子都以连接词开头会显得机械，可以靠内容和代词自然衔接。')
    add(!res.mix, '英美拼写一致', res.mix ? `英式：${res.mix.uk.join(', ')}；美式：${res.mix.us.join(', ')}` : '')
    return res
  }

  return { analyze, countWords, sentences, paragraphs, LINKERS, SUGGEST }
})
