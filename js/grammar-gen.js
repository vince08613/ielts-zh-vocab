/* Tense and voice drills: 7 tenses, active and passive, plus be (is/am/are, was/were).
   Builds items from data/grammar.js and judges answers. Pure functions (node tests use it). */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).grammarGen = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  const FORMS = [
    { id: 'pres-be', t: 'pres', v: 'be', pat: 'is / am / are', rule: 'be 随主语变化：I am，he / she / it / 单数名词 is，you / we / they / 复数名词 are。' },
    { id: 'pres-do', t: 'pres', v: 'act', pat: 'do / does', rule: '主语是第三人称单数（he / she / it / 单数名词）动词加 -s / -es，其余用原形；否定和疑问借助 do / does，后面接原形。' },
    { id: 'pres-pass', t: 'pres', v: 'pass', pat: 'is / am / are done', rule: '被动：am / is / are（随主语）+ 过去分词。' },
    { id: 'past-be', t: 'past', v: 'be', pat: 'was / were', rule: 'I / he / she / it / 单数名词用 was，you / we / they / 复数名词用 were。' },
    { id: 'past-do', t: 'past', v: 'act', pat: 'did', rule: '动词用过去式（不规则动词单独记）；否定和疑问用 did + 原形。' },
    { id: 'past-pass', t: 'past', v: 'pass', pat: 'was / were done', rule: '被动：was / were + 过去分词。' },
    { id: 'prog-do', t: 'prog', v: 'act', pat: 'is / am / are doing', rule: '现在进行：am / is / are + 动词 -ing，表示此刻正在做。' },
    { id: 'prog-pass', t: 'prog', v: 'pass', pat: 'is / am / are being done', rule: '现在进行被动：am / is / are + being + 过去分词。' },
    { id: 'pprog-do', t: 'pprog', v: 'act', pat: 'was / were doing', rule: '过去进行：was / were + 动词 -ing，表示过去某一时刻正在做。' },
    { id: 'pprog-pass', t: 'pprog', v: 'pass', pat: 'was / were being done', rule: '过去进行被动：was / were + being + 过去分词。' },
    { id: 'perf-do', t: 'perf', v: 'act', pat: 'has / have done', rule: '现在完成：has（第三人称单数）/ have + 过去分词，表示到现在已经完成或有影响。' },
    { id: 'perf-pass', t: 'perf', v: 'pass', pat: 'has / have been done', rule: '现在完成被动：has / have + been + 过去分词。' },
    { id: 'pperf-do', t: 'pperf', v: 'act', pat: 'had done', rule: '过去完成：had + 过去分词，表示在过去某个时间或动作之前已经完成（过去的过去）。' },
    { id: 'pperf-pass', t: 'pperf', v: 'pass', pat: 'had been done', rule: '过去完成被动：had + been + 过去分词。' },
    { id: 'fut-do', t: 'fut', v: 'act', pat: 'will do', rule: '一般将来：will + 动词原形，所有人称一样。' },
    { id: 'fut-pass', t: 'fut', v: 'pass', pat: 'will be done', rule: '一般将来被动：will + be + 过去分词。' },
  ]
  const TENSES = [
    { t: 'pres', name: '一般现在时' }, { t: 'past', name: '一般过去时' }, { t: 'prog', name: '现在进行时' }, { t: 'pprog', name: '过去进行时' },
    { t: 'perf', name: '现在完成时' }, { t: 'pperf', name: '过去完成时' }, { t: 'fut', name: '一般将来时' },
  ]
  const VOICE = { be: 'be 动词', act: '主动', pass: '被动' }
  const FORM = Object.fromEntries(FORMS.map(f => [f.id, Object.assign(f, { name: `${TENSES.find(x => x.t === f.t).name} · ${VOICE[f.v]}` })]))
  const TYPES = [
    { id: 'fill', name: '动词填空' }, { id: 'pass', name: '主动变被动' }, { id: 'trans', name: '句型转换' },
    { id: 'zh', name: '中译英' }, { id: 'fix', name: '改错' }, { id: 'id', name: '判断时态' },
  ]

  /* ---------- word forms ---------- */

  const third = b => (/(s|x|z|ch|sh|o)$/.test(b) ? `${b}es` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : `${b}s`)
  const DOUBLE = /^(stop|plan|cut|put|set|run|get|sit|swim|begin|shop|drop|ship|win)$/
  const ing = b => (/ie$/.test(b) ? `${b.slice(0, -2)}ying` : (/[^aeiou]e$/.test(b) || /[aiu]e$/.test(b)) ? `${b.slice(0, -1)}ing` : DOUBLE.test(b) ? `${b}${b.slice(-1)}ing` : `${b}ing`)
  const beP = per => (per === '1s' ? 'am' : per === '3s' ? 'is' : 'are')
  const beS = per => (per === '1s' || per === '3s' ? 'was' : 'were')
  const haveP = per => (per === '3s' ? 'has' : 'have')
  const OBJ = { I: 'me', he: 'him', she: 'her', we: 'us', they: 'them', you: 'you', it: 'it' }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

  /** Verb group words for a form. neg inserts not. */
  function verbGroup(form, per, v, neg) {
    const n = neg ? ['not'] : []
    switch (form) {
      case 'pres-be': return [beP(per), ...n]
      case 'past-be': return [beS(per), ...n]
      case 'pres-do': return neg ? [per === '3s' ? 'does' : 'do', 'not', v.b] : [per === '3s' ? third(v.b) : v.b]
      case 'past-do': return neg ? ['did', 'not', v.b] : [v.p]
      case 'pres-pass': return [beP(per), ...n, v.pp]
      case 'past-pass': return [beS(per), ...n, v.pp]
      case 'prog-do': return [beP(per), ...n, ing(v.b)]
      case 'prog-pass': return [beP(per), ...n, 'being', v.pp]
      case 'pprog-do': return [beS(per), ...n, ing(v.b)]
      case 'pprog-pass': return [beS(per), ...n, 'being', v.pp]
      case 'perf-do': return [haveP(per), ...n, v.pp]
      case 'perf-pass': return [haveP(per), ...n, 'been', v.pp]
      case 'pperf-do': return ['had', ...n, v.pp]
      case 'pperf-pass': return ['had', ...n, 'been', v.pp]
      case 'fut-do': return ['will', ...n, v.b]
      case 'fut-pass': return ['will', ...n, 'be', v.pp]
    }
    throw new Error(`unknown form ${form}`)
  }

  /** Common learner errors for a form (positive sentences). */
  function wrongGroups(form, per, v) {
    const beW = per === '3s' ? 'are' : 'is'
    const beSW = beS(per) === 'was' ? 'were' : 'was'
    const haveW = per === '3s' ? 'have' : 'has'
    const out = []
    const add = (cond, g, why) => cond && out.push({ g, why })
    const ppDiff = !!v && v.pp !== v.b
    const pDiff = !!v && v.p !== v.pp
    switch (form) {
      case 'pres-be': add(true, [per === '1s' ? 'is' : beW], 'be 和主语不一致'); break
      case 'past-be': add(true, [beSW], 'was / were 和主语不一致'); break
      case 'pres-do': add(true, [per === '3s' ? v.b : third(v.b)], per === '3s' ? '第三人称单数要加 -s' : '主语不是第三人称单数，不加 -s'); break
      case 'past-do': add(v.p !== v.b, [v.b], '过去的时间要用过去式'); break
      case 'pres-pass': add(true, [v.pp], '被动漏了 be'); add(true, [per === '1s' ? 'is' : beW, v.pp], 'be 和主语不一致'); add(ppDiff, [beP(per), v.b], '被动要用过去分词'); break
      case 'past-pass': add(true, [beSW, v.pp], 'was / were 和主语不一致'); add(pDiff, [beS(per), v.p], '被动用过去分词，不是过去式'); add(ppDiff, [beS(per), v.b], '被动要用过去分词'); break
      case 'prog-do': add(true, [ing(v.b)], '进行时漏了 be'); add(true, [beP(per), v.b], '进行时要用 -ing'); break
      case 'prog-pass': add(ppDiff, [beP(per), 'being', v.b], '被动要用过去分词'); add(true, [beP(per), 'been', v.pp], '进行被动是 being，不是 been'); break
      case 'pprog-do': add(true, [beSW, ing(v.b)], 'was / were 和主语不一致'); add(true, [beS(per), v.b], '进行时要用 -ing'); break
      case 'pprog-pass': add(true, [beS(per), 'been', v.pp], '进行被动是 being，不是 been'); add(ppDiff, [beS(per), 'being', v.b], '被动要用过去分词'); break
      case 'perf-do': add(true, [haveW, v.pp], 'has / have 和主语不一致'); add(pDiff, [haveP(per), v.p], '完成时用过去分词，不是过去式'); add(ppDiff, [haveP(per), v.b], '完成时要用过去分词'); break
      case 'perf-pass': add(true, [haveP(per), v.pp], '完成被动漏了 been'); add(ppDiff, [haveP(per), 'been', v.b], '被动要用过去分词'); add(true, [haveP(per), 'be', v.pp], '完成被动是 been'); break
      case 'pperf-do': add(pDiff, ['had', v.p], '完成时用过去分词，不是过去式'); add(true, [haveP(per), v.pp], '“过去的过去”要用过去完成时 had done'); break
      case 'pperf-pass': add(true, ['had', v.pp], '完成被动漏了 been'); add(ppDiff, ['had', 'been', v.b], '被动要用过去分词'); break
      case 'fut-do': add(true, ['will', third(v.b)], 'will 后面用原形'); add(true, ['will', 'to', v.b], 'will 后面不加 to'); break
      case 'fut-pass': add(true, ['will', v.b], '被动漏了 be，句子变成主语自己去做'); add(ppDiff, ['will', 'be', v.b], '被动要用过去分词'); add(true, ['will', 'been', v.pp], 'will 后面接 be，不是 been'); break
    }
    return out
  }

  /* ---------- data ---------- */

  function load(D) {
    const verbs = new Map(D.verbs.split('|').map((s) => {
      const [b, p, pp] = s.split(' ')
      return [b, { b, p, pp }]
    }))
    const scenes = D.scenes.map((s) => {
      const [ag, agZh, per, v, vZh, obj, objZh, pl, by, skip] = s.split('|')
      if (!verbs.has(v))
        throw new Error(`unknown verb ${v}`)
      return { ag, agZh, per, v: verbs.get(v), vZh, obj, objZh, pl: pl === '1', by: by === '1' && ag !== 'someone', skip: skip ? skip.split(',') : [] }
    })
    const be = D.be.map((s) => {
      const [subj, per, comp, span] = s.split('|')
      return { subj, per, comp, span: span || '' }
    })
    const markers = Object.fromEntries(Object.entries(D.markers).map(([k, list]) => [k, list.map((x) => {
      const [en, zh, span] = x.split('|')
      return { en, zh, span: span || '' }
    })]))
    return { verbs, scenes, be, markers }
  }

  /* ---------- sentences ---------- */

  const pick = (list, rng) => list[Math.floor(rng() * list.length)]
  const isBe = form => FORM[form].v === 'be'
  const isPass = form => FORM[form].v === 'pass'

  /** Parts of a statement: subject, verb group, the rest. */
  function parts(form, sc, neg, marker, withBy) {
    let m = marker.en
    if (neg && m === 'already')
      m = 'yet'
    if (isBe(form))
      return { subj: sc.subj, per: sc.per, vg: verbGroup(form, sc.per, null, neg), rest: [sc.comp, m] }
    if (isPass(form)) {
      const per = sc.pl ? '3p' : '3s'
      const by = withBy ? [`by ${OBJ[sc.ag] || sc.ag}`] : []
      return { subj: sc.obj, per, vg: verbGroup(form, per, sc.v, neg), rest: [...by, m] }
    }
    return { subj: sc.ag, per: sc.per, vg: verbGroup(form, sc.per, sc.v, neg), rest: [sc.obj, m] }
  }
  const statement = p => `${cap([p.subj, ...p.vg, ...p.rest].join(' '))}.`
  function question(form, p, sc) {
    let aux = p.vg[0]
    let tail = p.vg.slice(1)
    if (form === 'pres-do' || form === 'past-do') {
      aux = form === 'past-do' ? 'did' : p.per === '3s' ? 'does' : 'do'
      tail = [sc.v.b]
    }
    const rest = p.rest.map(x => (x === 'already' ? 'yet' : x))
    return `${cap([aux, p.subj === 'I' ? 'I' : p.subj, ...tail, ...rest].join(' '))}?`
  }

  function zhSentence(form, sc, marker) {
    const t = FORM[form].t
    const m = marker.zh
    const pass = isPass(form)
    const S = pass ? sc.objZh : sc.agZh
    const Vb = pass ? `被${sc.by ? sc.agZh : ''}${sc.vZh}` : sc.vZh
    const O = pass ? '' : sc.objZh
    switch (t) {
      case 'pres': return `${S}${m}${Vb}${O}。`
      case 'past': return `${S}${m}${Vb}了${O}。`
      case 'prog': return `${S}${m}正在${Vb}${O}。`
      case 'pprog': return `${m}，${S}正在${Vb}${O}。`
      case 'perf': return `${S}${m}${Vb}了${O}。`
      case 'pperf': return `${m}，${S}已经${Vb}了${O}。`
      case 'fut': return `${S}${m}会${Vb}${O}。`
    }
    return ''
  }

  /* ---------- comparing ---------- */

  /** Lower case, no punctuation, contractions expanded. "'s" may be is or has, so two forms. */
  function norms(s) {
    const base = String(s || '').toLowerCase().replace(/[‘’`´]/g, '\'')
      .replace(/\bwon't\b/g, 'will not').replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not').replace(/\bshan't\b/g, 'shall not')
      .replace(/n't\b/g, ' not').replace(/'re\b/g, ' are').replace(/'m\b/g, ' am').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will').replace(/'d\b/g, ' had')
      .replace(/[.,!?;:"]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!/'s\b/.test(base))
      return [base]
    return [base.replace(/'s\b/g, ' is'), base.replace(/'s\b/g, ' has')].map(x => x.replace(/\s+/g, ' '))
  }
  const same = (a, b) => norms(a).some(x => norms(b).includes(x))

  /* ---------- items ---------- */

  /**
   * One drill item. type: fill | pass | trans | zh | fix | id. form: target form id.
   * Returns { type, form, prompt, task, answers: [string], show, hint, chips, zh, options }.
   */
  function makeItem(type, form, data, rng) {
    const be = isBe(form)
    const tKey = be ? (FORM[form].t === 'pres' ? 'beP' : 'beS') : FORM[form].t
    // Skip pairings that read oddly, e.g. a habit for a one-off event, "a doctor today".
    const fit = (list, ok) => {
      const l = list.filter(ok)
      return l.length ? l : list
    }
    const sc = be ? pick(data.be, rng) : pick(fit(data.scenes, s => !s.skip.includes(FORM[form].t)), rng)
    const marker = pick(be ? fit(data.markers[tKey], m => !m.span || !sc.span || m.span === sc.span) : data.markers[tKey], rng)
    const withBy = !be && isPass(form) && sc.by
    if (type === 'fill') {
      const neg = rng() < 0.3
      const p = parts(form, sc, neg, marker, withBy)
      const base = be ? 'be' : sc.v.b
      return { type, form, sc, task: '用括号里动词的正确形式填空', prompt: `${cap(p.subj)} ____ (${neg ? 'not ' : ''}${base}) ${p.rest.join(' ')}.`, answers: [p.vg.join(' ')], show: p.vg.join(' '), full: statement(p), vg: p.vg }
    }
    if (type === 'pass') {
      const act = form.replace('-pass', '-do')
      const a = parts(act, sc, false, marker, false)
      const withP = parts(form, sc, false, marker, true)
      const without = parts(form, sc, false, marker, false)
      const answers = sc.by ? [statement(withP)] : [statement(without), statement(withP)]
      return { type, form, sc, task: sc.by ? '改为被动语态（保留 by 短语）' : '改为被动语态（by 短语可以省略）', prompt: statement(a), answers, show: answers[0], vg: withP.vg }
    }
    if (type === 'trans') {
      const p = parts(form, sc, false, marker, withBy)
      const toNeg = rng() < 0.5
      const n = parts(form, sc, true, marker, withBy)
      const target = toNeg ? statement(n) : question(form, p, sc)
      return { type, form, sc, task: toNeg ? '改为否定句' : '改为一般疑问句', prompt: statement(p), answers: [target], show: target, vg: toNeg ? n.vg : p.vg }
    }
    if (type === 'zh') {
      const p = parts(form, sc, false, marker, withBy)
      const answers = [statement(p)]
      if (isPass(form) && !sc.by)
        answers.push(statement(parts(form, sc, false, marker, true)))
      if (marker.en === 'already')
        answers.push(`${cap([p.subj, p.vg[0], 'already', ...p.vg.slice(1), ...p.rest.filter(x => x !== 'already')].join(' '))}.`)
      const chips = isPass(form) ? [sc.obj, sc.v.b, ...(sc.by ? [`by ${OBJ[sc.ag] || sc.ag}`] : []), marker.en] : [sc.ag, sc.v.b, sc.obj, marker.en]
      return { type, form, sc, task: '翻译成英文（注意时态和语态）', prompt: zhSentence(form, sc, marker), answers, show: answers[0], chips, vg: p.vg }
    }
    if (type === 'fix') {
      const p = parts(form, sc, false, marker, withBy)
      const errs = wrongGroups(form, p.per, be ? null : sc.v)
      if (!errs.length)
        return null
      const err = pick(errs, rng)
      const wrong = `${cap([p.subj, ...err.g, ...p.rest].join(' '))}.`
      if (same(wrong, statement(p)))
        return null
      return { type, form, sc, task: '找出动词错误，写出改正后的整句', prompt: wrong, answers: [statement(p)], show: statement(p), why: err.why, vg: p.vg }
    }
    if (type === 'id') {
      const neg = rng() < 0.25
      const p = parts(form, sc, neg, marker, withBy)
      return { type, form, sc, task: '这句话用的是哪种时态和语态？', prompt: statement(p), answers: [form], show: FORM[form].name, vg: p.vg, options: FORMS.map(f => f.id) }
    }
    return null
  }

  const TYPES_FOR = form => (isBe(form) ? ['fill', 'trans', 'fix', 'id'] : isPass(form) ? ['fill', 'pass', 'trans', 'zh', 'fix', 'id'] : ['fill', 'trans', 'zh', 'fix', 'id'])

  /** Specific feedback when the verb group is wrong. */
  function diagnose(item, answer) {
    const want = item.vg
    const got = norms(answer)[0].split(' ')
    const v = item.sc && item.sc.v
    const notes = []
    if (want.includes('been') && !got.includes('been'))
      notes.push('漏了 been：完成时的被动是 have / has / had been + 过去分词。')
    if (want.includes('being') && !got.includes('being'))
      notes.push('漏了 being：进行时的被动是 be + being + 过去分词。')
    if (want.includes('be') && !got.includes('be') && want[0] === 'will')
      notes.push('漏了 be：will 的被动是 will be + 过去分词。')
    if (v) {
      if (want.includes(v.pp) && v.p !== v.pp && got.includes(v.p) && !got.includes(v.pp))
        notes.push(`${v.b} 的过去分词是 ${v.pp}，${v.p} 是过去式。`)
      if (want.includes(v.pp) && v.b !== v.pp && got.includes(v.b) && !got.includes(v.pp))
        notes.push(`这里要用过去分词 ${v.pp}。`)
      if (want.includes(third(v.b)) && got.includes(v.b))
        notes.push(`主语是第三人称单数，动词要加 -s：${third(v.b)}。`)
      if (want.includes(v.b) && !want.includes(third(v.b)) && got.includes(third(v.b)))
        notes.push(`这里用原形 ${v.b}（主语不是第三人称单数，或前面有 do / does / did / will）。`)
      if (want.includes(ing(v.b)) && !got.includes(ing(v.b)))
        notes.push(`进行时用 -ing：${ing(v.b)}。`)
      if (FORM[item.form].v === 'act' && got.includes(v.pp) && !want.includes(v.pp) && /^(is|are|am|was|were)$/.test(got[got.indexOf(v.pp) - 1] || ''))
        notes.push('主语是动作的执行者，用主动语态。')
    }
    for (const [a, b] of [['is', 'are'], ['was', 'were'], ['has', 'have'], ['am', 'is']]) {
      if ((want.includes(a) && got.includes(b) && !got.includes(a)) || (want.includes(b) && got.includes(a) && !got.includes(b)))
        notes.push(`${want.includes(a) ? a : b} 要和主语一致。`)
    }
    if (got.includes('did') && v && got.includes(v.p) && v.p !== v.b)
      notes.push('did 后面用动词原形。')
    return [...new Set(notes)]
  }

  /** { ok, notes, expect }. For fill the answer is the verb group; for id the form id. */
  function judge(item, answer) {
    if (item.type === 'id')
      return { ok: answer === item.form, notes: answer === item.form ? [] : [FORM[item.form].rule], expect: FORM[item.form].name }
    const ok = item.answers.some(a => same(a, answer))
    if (ok)
      return { ok, notes: [], expect: item.show }
    const notes = diagnose(item, answer)
    const vgOk = norms(answer).some(x => ` ${x} `.includes(` ${item.vg.join(' ')} `))
    if (item.type !== 'fill' && vgOk)
      notes.push(item.type === 'trans' && /疑问/.test(item.task) ? '动词部分对了，注意疑问句语序：助动词提到主语前面。' : '动词部分对了，其他部分（主语、宾语、by 短语或时间）和要求不一致。')
    if (item.type === 'trans' && /疑问/.test(item.task) && !/\?\s*$/.test(answer))
      notes.push('疑问句末尾用问号。')
    notes.push(FORM[item.form].rule)
    return { ok, notes: [...new Set(notes)], expect: item.show }
  }

  /**
   * Plan a run. opts: { n, forms: [ids] | null, types: [ids] | null, stats: { form: { n, ok, last: [] } }, rng }.
   * Weak and unseen forms come up more often.
   */
  function plan(data, opts) {
    const rng = opts.rng || Math.random
    const forms = (opts.forms && opts.forms.length ? opts.forms : FORMS.map(f => f.id))
    const st = opts.stats || {}
    const weight = (f) => {
      const s = st[f]
      if (!s || !s.n)
        return 2
      const last = (s.last || []).slice(-10)
      const acc = last.length ? last.filter(Boolean).length / last.length : 1
      return 0.6 + 3 * (1 - acc)
    }
    const out = []
    let guard = 0
    while (out.length < opts.n && guard++ < opts.n * 30) {
      const total = forms.reduce((s, f) => s + weight(f), 0)
      let r = rng() * total
      let form = forms[0]
      for (const f of forms) {
        r -= weight(f)
        if (r <= 0) {
          form = f
          break
        }
      }
      const allowed = TYPES_FOR(form).filter(t => !opts.types || !opts.types.length || opts.types.includes(t))
      if (!allowed.length)
        continue
      const item = makeItem(pick(allowed, rng), form, data, rng)
      const prev = out[out.length - 1]
      if (item && !(prev && prev.prompt === item.prompt))
        out.push(item)
    }
    return out
  }

  return { FORMS, FORM, TENSES, TYPES, TYPES_FOR, load, verbGroup, wrongGroups, parts, statement, question, zhSentence, makeItem, judge, diagnose, plan, norms, same, third, ing }
})
