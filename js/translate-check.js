/* Automatic checking of an English translation against reference translations.
   Meaning: every sentence has hand-written meaning units (keys); each unit lists accepted
   wordings. Form: spelling (word list), grammar rules for common learner errors, and known
   traps for the sentence. Result: right / close / wrong plus explanations. Pure functions. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).translateCheck = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  /* ---------- verb lexicon ---------- */

  // base past pp
  const IRREGULAR = ('be was been|have had had|do did done|go went gone|make made made|take took taken|give gave given|write wrote written|'
    + 'build built built|buy bought bought|bring brought brought|catch caught caught|teach taught taught|think thought thought|'
    + 'find found found|sell sold sold|tell told told|leave left left|lose lost lost|pay paid paid|send sent sent|spend spent spent|'
    + 'keep kept kept|hold held held|feed fed fed|lend lent lent|steal stole stolen|forget forgot forgotten|hide hid hidden|'
    + 'fly flew flown|swim swam swum|sing sang sung|ring rang rung|drink drank drunk|wake woke woken|ride rode ridden|shake shook shaken|'
    + 'freeze froze frozen|bite bit bitten|beat beat beaten|win won won|see saw seen|eat ate eaten|choose chose chosen|drive drove driven|'
    + 'speak spoke spoken|break broke broken|begin began begun|know knew known|grow grew grown|throw threw thrown|draw drew drawn|'
    + 'show showed shown|wear wore worn|tear tore torn|fall fell fallen|rise rose risen|come came come|become became become|run ran run|'
    + 'cut cut cut|put put put|set set set|hit hit hit|shut shut shut|cost cost cost|let let let|read read read|meet met met|'
    + 'get got got|sit sat sat|stand stood stood|understand understood understood|lead led led|feel felt felt|hear heard heard|'
    + 'mean meant meant|sleep slept slept|sweep swept swept|deal dealt dealt|seek sought sought|fight fought fought|light lit lit|'
    + 'say said said|lay laid laid|forbid forbade forbidden|undertake undertook undertaken|overcome overcame overcome|withdraw withdrew withdrawn|'
    + 'arise arose arisen|forgive forgave forgiven|mislead misled misled')
    .split('|').map(s => s.split(' '))
  const REGULAR = ('attribute encourage prolong expose regard recognise recognize consider believe involve require allow enable permit '
    + 'prompt ignore threaten prevent reduce improve develop provide preserve protect solve tackle apply recruit employ hire attract '
    + 'receive create produce generate promote detect reveal cultivate educate publish replace remove determine achieve consume decide '
    + 'describe discuss establish explain expect identify include introduce invent prepare prove reject rely satisfy suggest deliver '
    + 'organise organize collect discover enjoy finish affect destroy pollute agree eliminate motivate inspire increase decrease decline '
    + 'raise limit support damage cause use change help work study travel visit clean cook paint repair wash invite plan design control '
    + 'record report order test answer ask call check close open fill follow kill like listen live look love miss move pass play post '
    + 'print pull push reach repeat return save serve share start stay stop talk thank touch try turn wait walk want warn wish worry '
    + 'need seem appear happen remain arrive continue manage contribute benefit focus emphasise emphasize criticise criticize censor '
    + 'exaggerate sensationalise sensationalize endanger strengthen enhance boost address handle assess evaluate measure estimate '
    + 'imprison punish fund finance invest construct renovate restore maintain sustain conserve extend shape influence persuade urge '
    + 'force arrest interview examine translate select accept complete prefer offer cancel deny admit borrow adopt advertise afford '
    + 'compare complain compete concentrate connect convince count cover cross decorate depend deserve disappear divide doubt '
    + 'earn enter escape exist explore export import fail fix form gather guess hate hope hurry imagine inform injure '
    + 'intend join jump knock last laugh learn lift mark marry matter mention mix name note notice obtain own pack park perform pick '
    + 'pour practise practice pray predict pretend pronounce protest purchase rain realise realize recommend recover outweigh '
    + 'reflect refuse relax release remember remind rent rescue research respond retire review rush seat separate settle smell '
    + 'smile smoke snow sound spell spoil supply suppose surprise surround survive switch taste tidy train transport treat '
    + 'trust type unite vote waste watch welcome commute migrate volunteer prioritise prioritize').split(/\s+/)
  // Bases that often follow "be" / "have" as nouns or adjectives, so "is + base" is not flagged.
  const NOUNISH = new Set(('work change love help travel visit study play test waste control record report order plan design support damage cause use '
    + 'limit increase decrease decline clean open close like last answer call check fill post print return rush stay stop talk touch turn wait walk want '
    + 'wish need fund finance cover cross doubt export import fix form guess hope hurry jump knock laugh lift mark matter mention mix name note notice pack '
    + 'park pick rain rent rescue research review seat separate smell smile smoke snow sound spell supply surprise switch taste train transport treat '
    + 'trust type vote watch welcome benefit focus shape influence force offer cancel interview sleep light lead set cut put hit cost let read run show fall '
    + 'rise deal fight win meet drink ring beat practice complete own respect').split(' '))

  const FORMS = new Map() // word -> [{ base, kind }]
  const addForm = (w, base, kind) => {
    const list = FORMS.get(w) || []
    if (!list.some(f => f.base === base && f.kind === kind))
      list.push({ base, kind })
    FORMS.set(w, list)
  }
  const third = b => (/(s|x|z|ch|sh|o)$/.test(b) ? `${b}es` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : `${b}s`)
  const DOUBLE = new Set('stop plan ship shop drop prefer refer admit permit commit control travel cancel regret occur hop jog rob rub skip slip trip wrap'.split(' '))
  function ingOf(b) {
    if (/^(be|see|agree|free|flee)$/.test(b))
      return `${b}ing`
    if (/ie$/.test(b))
      return `${b.slice(0, -2)}ying`
    if (/[^aeiou]e$/.test(b) || /[aiu]e$/.test(b))
      return `${b.slice(0, -1)}ing`
    if (DOUBLE.has(b) || /^(run|sit|get|put|cut|set|hit|win|swim|begin|forget|shut|let)$/.test(b))
      return `${b}${b.slice(-1)}ing`
    return `${b}ing`
  }
  function edOf(b) {
    if (/e$/.test(b))
      return `${b}d`
    if (/[^aeiou]y$/.test(b))
      return `${b.slice(0, -1)}ied`
    if (DOUBLE.has(b))
      return `${b}${b.slice(-1)}ed`
    return `${b}ed`
  }
  for (const [b, past, pp] of IRREGULAR) {
    addForm(b, b, 'base')
    addForm(past, b, 'past')
    addForm(pp, b, 'pp')
    addForm(ingOf(b), b, 'ing')
  }
  for (const [w, b, k] of [['is', 'be', 's'], ['am', 'be', 'base'], ['are', 'be', 'base'], ['were', 'be', 'past'], ['has', 'have', 's'], ['does', 'do', 's'], ['goes', 'go', 's']])
    addForm(w, b, k)
  for (const [b] of IRREGULAR) {
    if (!['be', 'have', 'do', 'go'].includes(b))
      addForm(third(b), b, 's')
  }
  for (const b of REGULAR) {
    addForm(b, b, 'base')
    addForm(third(b), b, 's')
    addForm(edOf(b), b, 'past')
    addForm(edOf(b), b, 'pp')
    addForm(ingOf(b), b, 'ing')
  }
  const IRR_BY_BASE = new Map(IRREGULAR.map(r => [r[0], r]))
  const ppOf = b => (IRR_BY_BASE.has(b) ? IRR_BY_BASE.get(b)[2] : edOf(b))
  const pastOf = b => (IRR_BY_BASE.has(b) ? IRR_BY_BASE.get(b)[1] : edOf(b))
  const forms = w => FORMS.get(w) || []
  const isKind = (w, kind) => forms(w).some(f => f.kind === kind)
  const baseOf = w => (forms(w)[0] || { base: w }).base
  // A base form after be / have that cannot be a noun or adjective there.
  const strictBase = w => isKind(w, 'base') && !NOUNISH.has(w) && ppOf(baseOf(w)) !== w && !isKind(w, 'past') && w !== 'be' && w !== 'are' && w !== 'am'
  // A simple past that is not also the participle or the base (went, wrote, took).
  const pastNotPp = w => isKind(w, 'past') && !isKind(w, 'pp') && !isKind(w, 'base') && w !== 'were' && w !== 'was'

  /* ---------- tokens ---------- */

  const LEMMA = new Map([['children', 'child'], ['men', 'man'], ['women', 'woman'], ['lives', 'life'], ['feet', 'foot'], ['teeth', 'tooth'],
    ['is', 'be'], ['am', 'be'], ['are', 'be'], ['was', 'be'], ['were', 'be'], ['been', 'be'], ['being', 'be'], ['has', 'have'], ['had', 'have'], ['having', 'have'],
    ['does', 'do'], ['did', 'do'], ['done', 'do'], ['doing', 'do'], ['goes', 'go'], ['went', 'go'], ['gone', 'go'], ['analyses', 'analysis'], ['crises', 'crisis']])
  const NO_LEMMA = new Set('read cut put set hit shut cost let beat come become run found left lead saw fell rose lay light meant stood felt won bit lit ring'.split(' '))
  for (const [b, past, pp] of IRREGULAR) {
    for (const f of [past, pp, third(b), ingOf(b)]) {
      if (!LEMMA.has(f) && f !== b && !NO_LEMMA.has(f))
        LEMMA.set(f, b)
    }
  }
  const ING_KEEP = new Set('bring thing sing ring king wing sting spring string swing cling fling sling during morning evening ceiling nothing something anything everything'.split(' '))
  const EED_KEEP = new Set('need feed seed speed proceed succeed exceed bleed breed greed deed weed heed steed'.split(' '))

  function stem(word) {
    let w = String(word).toLowerCase()
    if (LEMMA.has(w))
      w = LEMMA.get(w)
    if (w.length <= 2)
      return w
    let s = w
    let cut = false
    if (w.length > 4 && /ie[sd]$/.test(w))
      s = `${w.slice(0, -3)}y`
    else if (/(ss|us|is)$/.test(w))
      s = w
    else if (/(sh|ch|x|z|ss)es$/.test(w))
      s = w.slice(0, -2)
    else if (w.length >= 5 && /ing$/.test(w) && !ING_KEEP.has(w))
      [s, cut] = [w.slice(0, -3), true]
    else if (/eed$/.test(w))
      s = EED_KEEP.has(w) ? w : w.slice(0, -1)
    else if (w.length >= 4 && /ed$/.test(w))
      [s, cut] = [w.slice(0, -2), true]
    else if (/s$/.test(w))
      s = w.slice(0, -1)
    if (cut && /([bdfgkmnprtvz])\1$/.test(s))
      s = s.slice(0, -1)
    if (s.length >= 3 && s.endsWith('e'))
      s = s.slice(0, -1)
    return s
  }

  const clean = s => String(s == null ? '' : s).normalize('NFKC').replace(/[‘’`´]/g, '\'').replace(/[“”]/g, '"').replace(/[‐-―−]/g, '-')
  const NT = { ca: 'can', wo: 'will', sha: 'shall' }
  const IS_S = new Set('it that there he she what who here where how this'.split(' '))
  const CLIT = { re: 'are', ve: 'have', ll: 'will', d: 'would', m: 'am' }

  /** Word and punctuation tokens. Contractions expand (don't -> do + not); hyphenated words split. */
  function tokenize(text) {
    const src = clean(text)
    const out = []
    const re = /([A-Za-z0-9]+(?:'[A-Za-z]+)?'?)|([,.;:!?，。；：！？])/g
    let m
    while ((m = re.exec(src))) {
      const s = m.index
      const e = s + m[0].length
      if (m[2]) {
        out.push({ p: m[2], s, e })
        continue
      }
      const raw = m[1]
      const hy = s > 1 && src[s - 1] === '-' && /[A-Za-z0-9]/.test(src[s - 2])
      const push = (w, extra) => out.push(Object.assign({ raw, w, st: stem(w), s, e, hy, cap: /^[A-Z]/.test(raw) }, extra))
      const low = raw.toLowerCase()
      let mm
      if ((mm = low.match(/^([a-z]+)n't$/))) {
        push(NT[mm[1]] || mm[1], { contr: true })
        push('not', { contr: true })
      }
      else if (low === 'cannot') {
        push('can')
        push('not')
      }
      else if ((mm = low.match(/^([a-z0-9]+)'s$/))) {
        if (IS_S.has(mm[1])) {
          push(mm[1], { contr: true })
          push('is', { contr: true })
        }
        else {
          push(mm[1], { poss: true, ps: mm[1].endsWith('s') })
        }
      }
      else if ((mm = low.match(/^([a-z]+)'(re|ve|ll|d|m)$/))) {
        push(mm[1], { contr: true })
        push(CLIT[mm[2]], { contr: true })
      }
      else if ((mm = low.match(/^([a-z0-9]+)'$/))) {
        push(mm[1], { poss: true })
      }
      else {
        push(low.replace(/'/g, ''))
      }
    }
    return out
  }
  const wordsOf = toks => toks.filter(t => t.w)

  /* ---------- meaning units ---------- */

  let macros = {}
  function setMacros(obj) {
    macros = {}
    for (const [k, v] of Object.entries(obj || {}))
      macros[k] = v.split('|').map(elem)
  }

  /** One token pattern: stem, prefix*, @macro or a/b alternatives. */
  function elem(p) {
    if (p.includes('/') && p.length > 1)
      return { any: p.split('/').map(elem) }
    if (p.startsWith('@'))
      return { macro: p.slice(1) }
    if (p.endsWith('*'))
      return { pre: p.slice(0, -1).toLowerCase() }
    return { st: stem(p) }
  }
  function hit(el, t) {
    if (!t || !t.w)
      return false
    if (el.any)
      return el.any.some(x => hit(x, t))
    if (el.macro)
      return (macros[el.macro] || []).some(x => hit(x, t))
    if (el.pre != null)
      return t.w.startsWith(el.pre)
    return t.st === el.st
  }

  /**
   * Alternatives: "a b" ordered (up to 3 words between), "a+b" any order, "/regex/" on the raw text.
   * Hyphenated words are split, so "self-confidence" is written "self confidence" or "self+confidence".
   */
  function parseAlt(a) {
    a = a.trim()
    if (a.length > 2 && a.startsWith('/') && a.endsWith('/'))
      return { re: new RegExp(a.slice(1, -1), 'i') }
    if (/\s/.test(a))
      return { seq: a.split(/\s+/).map(elem) }
    return { set: a.split('+').map(elem) }
  }

  function parseKey(k) {
    const opt = k.startsWith('?')
    const body = opt ? k.slice(1) : k
    const i = body.indexOf('=')
    return { zh: body.slice(0, i), opt, alts: splitAlts(body.slice(i + 1)).map(parseAlt) }
  }
  // Regex alternatives must not contain "|".
  const splitAlts = s => s.split('|').filter(x => x.trim())

  /** Indexes of the words that match an alternative, or null. */
  function matchAlt(alt, ws, text) {
    if (alt.re)
      return alt.re.test(text) ? [] : null
    if (alt.set) {
      const used = []
      for (const el of alt.set) {
        const i = ws.findIndex((t, j) => !used.includes(j) && hit(el, t))
        if (i < 0)
          return null
        used.push(i)
      }
      return used
    }
    for (let start = 0; start < ws.length; start++) {
      if (!hit(alt.seq[0], ws[start]))
        continue
      const at = [start]
      for (let k = 1; k < alt.seq.length; k++) {
        const from = at[at.length - 1] + 1
        let j = from
        while (j < ws.length && j <= from + 3 && !hit(alt.seq[k], ws[j]))
          j++
        if (j >= ws.length || j > from + 3)
          break
        at.push(j)
      }
      if (at.length === alt.seq.length)
        return at
    }
    return null
  }

  function matchKey(key, ws, text) {
    for (const alt of key.alts) {
      const at = matchAlt(alt, ws, text)
      if (at)
        return at
    }
    return null
  }

  /* ---------- spelling ---------- */

  let dict = null
  let byFirst = null
  let canon = new Map()
  function setDict(text) {
    dict = new Set(String(text || '').split('\n'))
    byFirst = null
  }
  function setSpelling(rows) {
    canon = new Map()
    for (const r of rows || []) {
      const all = [...r.uk, ...r.us].map(x => x.toLowerCase())
      for (const f of all)
        canon.set(f, all[0])
    }
  }
  const hasDict = () => !!dict

  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max)
      return max + 1
    let prev2 = null
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]
      let low = i
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        if (prev2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          v = Math.min(v, prev2[j - 2] + 1)
        cur.push(v)
        low = Math.min(low, v)
      }
      if (low > max)
        return max + 1
      prev2 = prev
      prev = cur
    }
    return prev[b.length]
  }

  function suggest(w, prefer) {
    const max = w.length <= 4 ? 1 : 2
    const scored = []
    for (const c of prefer) {
      const d = distance(w, c, max)
      if (d <= max && c !== w)
        scored.push([c, d - 0.5])
    }
    if (dict) {
      if (!byFirst) {
        byFirst = new Map()
        for (const x of dict) {
          if (!byFirst.has(x[0]))
            byFirst.set(x[0], [])
          byFirst.get(x[0]).push(x)
        }
      }
      for (const f of new Set([w[0], w[1]].filter(Boolean))) {
        for (const c of byFirst.get(f) || []) {
          if (c !== w && Math.abs(c.length - w.length) <= max && !c.includes('\''))
            scored.push([c, distance(w, c, max)])
        }
      }
    }
    return [...new Set(scored.filter(s => s[1] <= max).sort((a, b) => a[1] - b[1] || Math.abs(a[0].length - w.length) - Math.abs(b[0].length - w.length)).map(s => s[0]))].slice(0, 3)
  }

  /* ---------- grammar rules ---------- */

  const MODAL = new Set('can could will would shall should may might must'.split(' '))
  const ADV = new Set(('not also still only never always often really even easily usually probably certainly definitely sometimes partially partly further '
    + 'then hardly seldom rarely actually eventually soon already perhaps just gradually significantly greatly effectively largely increasingly simply '
    + 'therefore thus widely generally commonly highly well now mainly mostly heavily ever recently long normally typically frequently no longer').split(' '))
  const BE = new Set('am is are was were be been being'.split(' '))
  const DET = new Set('a an the no any some this that these those its their his her our my your much little less more every each one another such what which whatever either neither'.split(' '))
  const PREP = new Set('of for with to from among by in on at about between than like under over through without within across around behind during into towards toward against upon via per'.split(' '))
  const OBJ = new Set('them him her us me people children students someone everyone individuals parents workers employees citizens consumers'.split(' '))
  const LEAD_IN = new Set('do does did can could will would should may might must to let lets make makes made help helps helped have has had see saw watch hear'.split(' '))
  const SING_S = new Set(('news series species means mathematics physics economics politics ethics statistics this his its us bus gas yes always perhaps sometimes '
    + 'besides unless whereas thus plus lens chaos crisis analysis basis emphasis process success access business address progress class glass mass pass less across').split(' '))
  const COMPAR = new Set(('easier bigger smaller faster cheaper better worse larger greater higher lower longer shorter stronger weaker happier healthier richer '
    + 'poorer safer wiser calmer quicker slower busier harder younger older closer cleaner clearer simpler wider deeper heavier lighter nearer newer warmer colder hotter').split(' '))
  const MANY = new Set('many several numerous various countless few two three four five six seven eight nine ten twenty'.split(' '))
  const ARTICLE_NOUN = new Set('difference role impact threat contribution decision mistake effect effort'.split(' '))
  const ARTICLE_VERB = new Set(['mak', 'play', 'have', 'pos', 'exert'])
  const TO_VERBS = new Set('allow allows allowed enable enables enabled encourage encourages encouraged force forces forced permit permits permitted persuade require requires required cause causes caused ask asks asked want wants wanted expect expects expected urge urges urged invite forbid motivate motivates inspire inspires'.split(' '))
  const VOWEL_CONS = /^(uni|use|usu|uti|eu|one|once|ur[aeiou]|uk$)/
  const SILENT_H = /^(hour|honest|honou?r|heir)/
  // Verbs that commonly follow a singular subject; "the slowdown lead" misses the -s.
  const PRED = new Set('lead cause make have help give play pose bring take become mean affect increase reduce improve require need allow encourage provide create result contribute depend seem remain do offer enable prevent hinder determine shape influence benefit harm damage threaten'.split(' '))
  const COLLECTIVE = new Set('government public media staff team family police people children men women feet teeth mice data committee audience majority minority youth rich poor young old elderly unemployed crew class army jury board council'.split(' '))

  const skipAdv = (ws, j) => {
    while (j < ws.length && ADV.has(ws[j].w))
      j++
    return j
  }
  const AGREE = { is: 'are', was: 'were', has: 'have', does: 'do' }

  function grammar(toks, ws) {
    const out = []
    const add = (a, b, msg, fix) => out.push({ kind: 'grammar', level: 'error', s: a.s, e: (b || a).e, msg, fix })
    const pos = new Map(ws.map((t, i) => [t, i]))
    const clauseStart = new Set([0])
    toks.forEach((t, k) => {
      if (t.p && toks[k + 1] && toks[k + 1].w)
        clauseStart.add(pos.get(toks[k + 1]))
    })
    const lineEnd = new Set()
    toks.forEach((t, k) => {
      if (t.w && (!toks[k + 1] || toks[k + 1].p))
        lineEnd.add(pos.get(t))
    })
    for (let i = 0; i < ws.length; i++) {
      const t = ws[i]
      const w = t.w
      const p = ws[i - 1]
      const n1 = ws[i + 1]
      const n2 = ws[i + 2]
      if (MODAL.has(w) && !(w === 'may' && t.cap && i > 0) && !(p && DET.has(p.w))) {
        const n = ws[skipAdv(ws, i + 1)]
        if (n && n.w === 'to')
          add(t, n, `${w} 是情态动词，后面直接接动词原形，不加 to。`, `${w} + 动词原形`)
        else if (n && !isKind(n.w, 'base') && (isKind(n.w, 's') || isKind(n.w, 'past') || isKind(n.w, 'ing') || n.w === 'been') && !NOUNISH.has(baseOf(n.w)))
          add(t, n, `情态动词 ${w} 后面用动词原形。`, `${w} ${n.w === 'been' ? 'be / have been' : baseOf(n.w)}`)
        else if (n && !isKind(n.w, 'base') && (isKind(n.w, 's') || pastNotPp(n.w) || /ed$/.test(n.w)) && FORMS.has(n.w) && !(ws[skipAdv(ws, i + 1) + 1] && /^(of|in|for)$/.test(ws[skipAdv(ws, i + 1) + 1].w) && !isKind(n.w, 'past')))
          add(t, n, `情态动词 ${w} 后面用动词原形。`, `${w} ${n.w === 'been' ? 'be / have been' : baseOf(n.w)}`)
      }
      if (/^(do|does|did)$/.test(w) && n1 && n1.w === 'not') {
        const n = ws[skipAdv(ws, i + 2)]
        if (n && !isKind(n.w, 'base') && (isKind(n.w, 's') || isKind(n.w, 'past')))
          add(t, n, `${w} not 后面用动词原形。`, `${w} not ${baseOf(n.w)}`)
      }
      if (w === 'did' && n1 && pastNotPp(n1.w))
        add(t, n1, 'did 后面用动词原形。', `did ${baseOf(n1.w)}`)
      if (/^(have|has|had)$/.test(w)) {
        const j = skipAdv(ws, i + 1)
        const n = ws[j]
        if (n && (pastNotPp(n.w) || (strictBase(n.w) && !(ws[j + 1] && ws[j + 1].w === 'to'))) && !(n.w === 'better'))
          add(t, n, '完成时是 have / has / had + 过去分词。', `${w} ${ppOf(baseOf(n.w))}`)
      }
      if (BE.has(w)) {
        const n = ws[skipAdv(ws, i + 1)]
        if (n && n.w === 'been' && /^(am|is|are|was|were)$/.test(w))
          add(t, n, `${w} been 不成立：进行时的被动是 ${w} being done，完成时的被动是 has / have been done。`, `${w} being … / has been …`)
        else if (n && strictBase(n.w))
          add(t, n, 'be 动词后面不能直接接动词原形：被动语态用过去分词，进行时用 -ing；agree 这类动词本身就是谓语，前面不加 be。', `${w} ${ppOf(baseOf(n.w))} / ${w} ${ingOf(baseOf(n.w))}`)
        else if (n && pastNotPp(n.w))
          add(t, n, '被动语态是 be + 过去分词，不用过去式。', `${w} ${ppOf(baseOf(n.w))}`)
      }
      if (w === 'to' && n1 && (pastNotPp(n1.w) || (isKind(n1.w, 's') && !isKind(n1.w, 'base') && strictBase(baseOf(n1.w)))))
        add(t, n1, 'to 后面用动词原形。', `to ${baseOf(n1.w)}`)
      if (w === 'able' && n1 && n1.w === 'to' && n2 && isKind(n2.w, 'ing') && !isKind(n2.w, 'base'))
        add(t, n2, 'be able to 后面用动词原形。', `able to ${baseOf(n2.w)}`)
      // Subject-verb agreement.
      if (n1 && /^(we|you|they)$/.test(w) && AGREE[n1.w])
        add(t, n1, `${w} 是复数主语，动词用复数形式。`, `${w} ${AGREE[n1.w]}`)
      if (n1 && w === 'i' && /^(is|are|has|does)$/.test(n1.w))
        add(t, n1, 'I 后面用 am / have / do。', `I ${{ is: 'am', are: 'am', has: 'have', does: 'do' }[n1.w]}`)
      const afterPrep = j => [1, 2, 3].some(d => !clauseStart.has(j - d + 1) && ws[j - d] && PREP.has(ws[j - d].w))
      if (n1 && /^(people|children|men|women|police)$/.test(w) && AGREE[n1.w] && !afterPrep(i))
        add(t, n1, `${w} 是复数，动词用复数形式。`, `${w} ${AGREE[n1.w]}`)
      if (n1 && /^(he|she|it)$/.test(w) && !(p && LEAD_IN.has(p.w))) {
        if (/^(are|were|have|do)$/.test(n1.w) && !(n1.w === 'were'))
          add(t, n1, `${w} 是第三人称单数，动词用单数形式。`, `${w} ${{ are: 'is', have: 'has', do: 'does' }[n1.w]}`)
        else if (strictBase(n1.w) && !(n2 && n2.w === 'to'))
          add(t, n1, `${w} 是第三人称单数，一般现在时的动词要加 -s。`, `${w} ${third(n1.w)}`)
      }
      if (n1 && AGREE[n1.w] && w.length > 3 && w.endsWith('s') && !t.poss && !SING_S.has(w) && !/(ss|us|is|ics)$/.test(w) && dict && dict.has(w.slice(0, -1)) && !afterPrep(i)
        && (clauseStart.has(i) || (p && /^(many|the|these|those|some|most|all|such|both|several|few|various|numerous|our|their|my|his|her|its|your)$/.test(p.w))))
        add(t, n1, `${w} 是复数主语，动词用复数形式。`, `${w} ${AGREE[n1.w]}`)
      // "The economic slowdown lead to ...": singular noun phrase at the start of a clause + base verb.
      if (/^(the|this|that|a|an|its|his|her|our|their|my|your|every|each)$/.test(w) && clauseStart.has(i)) {
        let j = i + 1
        while (j < ws.length && j <= i + 3 && !PRED.has(ws[j].w) && !FORMS.has(ws[j].w) && !PREP.has(ws[j].w) && !ws[j].poss && !MODAL.has(ws[j].w) && !/^(and|or|who|which|that|not|to)$/.test(ws[j].w))
          j++
        const v = ws[j]
        const head = ws[j - 1]
        // "The major benefit is ...": a finite verb right after means the candidate is the head noun.
        const nounHead = ws[j + 1] && (MODAL.has(ws[j + 1].w) || /^(is|are|was|were|has|have|had|does|do|did|not)$/.test(ws[j + 1].w))
        if (v && j > i + 1 && j <= i + 4 && PRED.has(v.w) && head && !head.w.endsWith('s') && !COLLECTIVE.has(head.w) && !/^(this|that|which|who)$/.test(w + head.w) && !(w === 'that' || w === 'this') && !nounHead)
          add(head, v, '主语是单数名词，一般现在时的动词要加 -s（或用过去式、情态动词）。', `${head.raw} ${third(v.w)}`)
      }
      if (w === 'peoples' && !t.poss && n1 && !/^(of|and|in|who|have|are|were|living)$/.test(n1.w))
        add(t, null, 'people 的所有格是 people\'s；peoples 指“各民族”。', 'people\'s')
      if (w === 'there' && n1 && /^(is|was)$/.test(n1.w) && n2 && (MANY.has(n2.w) || (n2.w === 'a' && ws[i + 3] && /^(few|number)$/.test(ws[i + 3].w))))
        add(t, n1, 'there be 的 be 和后面的名词一致：后面是复数，用 there are / were。', `there ${n1.w === 'is' ? 'are' : 'were'}`)
      if (w === 'there' && n1 && /^(are|were)$/.test(n1.w) && n2 && /^(a|an|one)$/.test(n2.w) && !ws.slice(i + 3, i + 7).some(x => /^(of|few|many|lot)$/.test(x.w)))
        add(t, n1, 'there be 的 be 和后面的名词一致：后面是单数，用 there is / was。', `there ${n1.w === 'are' ? 'is' : 'was'}`)
      // Articles.
      if ((w === 'a' || w === 'an') && n1 && /^[a-z]/.test(n1.w) && n1.raw !== n1.raw.toUpperCase()) {
        const vowel = /^[aeiou]/.test(n1.w) && !VOWEL_CONS.test(n1.w)
        if (w === 'a' && (vowel || SILENT_H.test(n1.w)))
          add(t, n1, '以元音音素开头的词前用 an。', `an ${n1.raw}`)
        if (w === 'an' && !vowel && !SILENT_H.test(n1.w))
          add(t, n1, '以辅音音素开头的词前用 a。', `a ${n1.raw}`)
      }
      if (ARTICLE_VERB.has(t.st) || BE.has(w)) {
        let j = i + 1
        let det = false
        while (j < ws.length && j <= i + 3 && !ARTICLE_NOUN.has(ws[j].w)) {
          if (DET.has(ws[j].w) || ws[j].poss)
            det = true
          j++
        }
        const nn = ws[j]
        if (nn && j <= i + 3 && ARTICLE_NOUN.has(nn.w) && !det && (BE.has(w) ? nn.w === 'threat' && j === i + 1 : true) && !(nn.w === 'effect' && t.st === 'tak')
          && !(t.st === 'have' && nn.w === 'effect' && j === i + 1 && ws[j + 1] && ws[j + 1].w === 'on' && false))
          add(t, nn, `${nn.w} 在这里是可数名词，前面要有冠词：make a difference / play a role / have an impact on / pose a threat to。`, `${t.raw} a … ${nn.w}`)
      }
      // Fixed patterns.
      if ((w === 'discuss' || w === 'discussed' || w === 'discusses' || w === 'mention' || w === 'mentioned') && n1 && n1.w === 'about')
        add(t, n1, `${w} 是及物动词，后面不加 about。`, `${w} + 宾语`)
      if (/^emphasi[sz]e[sd]?$/.test(w) && n1 && n1.w === 'on')
        add(t, n1, 'emphasise 后面直接接宾语，不加 on。', 'emphasise sth')
      if (w === 'despite' && n1 && n1.w === 'of')
        add(t, n1, 'despite 后面不加 of（in spite of 才有 of）。', 'despite + 名词')
      if (t.st === 'lead' && n1 && n1.w === 'to' && n2 && strictBase(n2.w) && !NOUNISH.has(n2.w))
        add(t, n2, 'lead to 的 to 是介词，后面接名词或动名词。', `lead to ${ingOf(n2.w)} / 名词`)
      if (/^(make|makes|making|let|lets)$/.test(w) && n1 && OBJ.has(n1.w) && n2 && n2.w === 'to')
        add(t, n2, `${w} sb do：使役动词后面的动词不带 to。`, `${w} ${n1.w} + 动词原形`)
      if (TO_VERBS.has(w) && n1 && OBJ.has(n1.w) && n2 && strictBase(n2.w))
        add(t, n2, `${baseOf(w)} sb to do：后面的动词前要有 to。`, `${w} ${n1.w} to ${n2.w}`)
      if (/^(suggest|suggests|suggested)$/.test(w) && n1 && OBJ.has(n1.w) && n2 && n2.w === 'to')
        add(t, n2, 'suggest 不接 sb to do，用 suggest that sb (should) do 或 suggest doing。', 'suggest that sb do')
      if (w === 'more' && n1 && COMPAR.has(n1.w))
        add(t, n1, `${n1.w} 已经是比较级，前面不加 more。`, n1.w)
      if (COMPAR.has(w) || (w === 'more' || w === 'less' || w === 'rather')) {
        const k = ws.slice(i + 1, i + 5).findIndex(x => x.w === 'then')
        if (k >= 0)
          add(ws[i + 1 + k], null, '比较用 than，then 是“然后”。', 'than')
      }
      if (w === 'everyday' && (lineEnd.has(i) || (n1 && PREP.has(n1.w))))
        add(t, null, 'everyday 是形容词（日常的），作状语“每天”要写成 every day。', 'every day')
      if (/^(most|many|some|each|one|none|both|several|few)$/.test(w) && n1 && n1.w === 'of' && n2 && !DET.has(n2.w) && !/^(them|us|you|it|which|whom|those|these|these)$/.test(n2.w) && !n2.cap && !n2.poss && !/^\d/.test(n2.w))
        add(n1, n2, `${w} of 后面要接 the / these / their / them 等限定词；泛指时直接用 ${w} + 名词。`, `${w} of the … / ${w} …`)
      if (n1 && n1.w === w && !/^(had|that|is)$/.test(w) && !n1.hy)
        add(t, n1, `${w} 重复了。`, w)
      if (t.poss && t.raw.toLowerCase().endsWith('s\'s'))
        add(t, null, '以 s 结尾的复数名词，所有格只加撇号。', `${t.raw.slice(0, -2)}`)
      if (w === 'affect' && p && DET.has(p.w))
        add(t, null, '名词“影响、效果”是 effect；affect 一般作动词。', 'effect')
    }
    return out
  }

  const SUB = /\b(although|though|because|since|if|when|while|whereas|unless|as|before|after|once)\b/
  function patterns(text, toks) {
    const out = []
    const low = clean(text).toLowerCase()
    const at = (re, msg, fix, level) => {
      const m = low.match(re)
      if (m)
        out.push({ kind: level ? 'style' : 'grammar', level: level || 'error', s: m.index, e: m.index + m[0].length, msg, fix })
    }
    at(/\b(?:although|though|even though)\b[^.!?;]*,\s*but\b/, 'although 和 but 不能同时用。', '删掉 but')
    at(/^\s*because\b[^.!?;]*,\s*so\b/, 'because 和 so 不能同时用。', '删掉 so')
    at(/\baccording to my (?:opinion|view)\b/, 'according to 不和 my opinion 连用。', 'In my opinion')
    at(/\bin my (?:opinion|view),?\s+i (?:think|believe)\b/, 'In my opinion 和 I think 意思重复。', '保留一个')
    at(/\bthe society\b/, '泛指“社会”时 society 不加 the。', 'society', 'warn')
    at(/\b(?:informations|advices|equipments|knowledges|furnitures|researches|homeworks)\b/, '这个词是不可数名词，没有复数形式。', '去掉 s')
    at(/\b(?:a lot of|lots of|kids?|stuff|gonna|wanna|really|totally|super)\b/, '偏口语，书面语换成更正式的说法。', 'a large number of / children / significantly', 'tip')
    if (toks.some(t => t.contr))
      out.push({ kind: 'style', level: 'tip', msg: '正式写作一般不用缩写。', fix: 'do not / cannot / it is' })
    // Comma splice: ", they are ..." joining two full sentences. An opening phrase without a verb is fine.
    // So are fixed linking phrases that happen to contain a verb ("That is to say, ...").
    const LEAD = /^\s*(?:that is(?: to say)?|what is more|what's more|that being said|having said that|needless to say|be that as it may|it is true|as is often the case|as we all know|as is known to all|as far as i am concerned|as i see it|if so|if not|that said)\s*$/
    const sents = clean(text).split(/[.!?;]+/)
    for (const s of sents) {
      const m0 = s.toLowerCase().match(/,\s*(it|this|they|he|she|we|these)\s+([a-z]+)\b/)
      const m = m0 && (/^(is|are|was|were|has|have|can|will|would|could|may|might|should|must)$/.test(m0[2]) || (isKind(m0[2], 's') && !isKind(m0[2], 'base') && m0[2].length > 3) || pastNotPp(m0[2]) || (isKind(m0[2], 'past') && /ed$/.test(m0[2]))) ? m0 : null
      const before = m ? s.toLowerCase().slice(0, m.index) : ''
      const finite = wordsOf(tokenize(before)).some(t => /^(am|is|are|was|were|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must)$/.test(t.w) || (isKind(t.w, 's') && !isKind(t.w, 'base') && t.w.length > 3) || pastNotPp(t.w))
      if (m && finite && !SUB.test(before) && !LEAD.test(before))
        out.push({ kind: 'grammar', level: 'warn', msg: '逗号不能直接连接两个完整的句子：用句号、分号，或改成 which / and 连接。', fix: '. / ; / , which' })
    }
    return out
  }

  /* ---------- comparing with references ---------- */

  const canonWord = w => canon.get(w) || w
  /** Normalised comparison form: lower case, no punctuation, contractions expanded, one spelling. */
  const flat = s => wordsOf(tokenize(s)).map(t => (t.poss ? t.raw.toLowerCase() : canonWord(t.w))).join(' ')

  /** "a (b) c / d" in a reference: optional words in brackets, word alternatives with "/". */
  function expandRef(ref) {
    let list = [String(ref)]
    for (let guard = 0; guard < 6; guard++) {
      const next = []
      let changed = false
      for (const r of list) {
        const m = r.match(/\(([^()]*)\)/)
        if (m) {
          changed = true
          next.push(r.replace(m[0], m[1]).replace(/\s+/g, ' '), r.replace(m[0], '').replace(/\s+/g, ' '))
          continue
        }
        const s = r.match(/([A-Za-z'-]+)\/([A-Za-z'-]+)/)
        if (s) {
          changed = true
          next.push(r.replace(s[0], s[1]), r.replace(s[0], s[2]))
          continue
        }
        next.push(r)
      }
      list = next
      if (!changed)
        break
    }
    return [...new Set(list.map(x => x.replace(/\s+([,.])/g, '$1').trim()))]
  }

  function lcs(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
    const inB = new Set()
    const inA = new Set()
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        inA.add(i)
        inB.add(j)
        i++
        j++
      }
      else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++
      }
      else {
        j++
      }
    }
    return { n: dp[0][0], inA, inB }
  }

  /**
   * Check one translation.
   * item: { refs: [string], keys: [string], traps: [[pattern, message]], accepted: [string] }
   * Returns { verdict: 'right' | 'close' | 'wrong', exact, issues, keys, ref, refWords, marks, score }.
   */
  function check(answer, item) {
    const text = clean(answer).trim()
    const toks = tokenize(text)
    const ws = wordsOf(toks)
    const refs = (item.refs || []).flatMap(expandRef)
    const accepted = item.accepted || []
    const issues = []
    const marks = []
    const flatA = flat(text)
    const exact = !item.noExact && !!flatA && [...refs, ...accepted].some(r => flat(r) === flatA)

    if (/[\u4e00-\u9fff]/.test(text))
      issues.push({ kind: 'meaning', level: 'error', msg: '答案里有中文，请全部写成英文。' })
    if (/[，。；：！？]/.test(text))
      issues.push({ kind: 'style', level: 'tip', msg: '用英文标点（, . ; ?），不用中文标点。' })
    if (ws.length < 3 && !exact)
      issues.push({ kind: 'meaning', level: 'error', msg: '句子不完整。' })

    // Spelling.
    const refWords = new Set(refs.flatMap(r => wordsOf(tokenize(r)).map(t => t.w)))
    const okWords = new Set([...refWords, ...accepted.flatMap(r => wordsOf(tokenize(r)).map(t => t.w))])
    if (dict) {
      ws.forEach((t, i) => {
        if (t.w.length < 2 || /\d/.test(t.w) || okWords.has(t.w) || dict.has(t.w) || canon.has(t.w) || (t.cap && i > 0 && !t.hy))
          return
        const sug = suggest(t.w, [...refWords])
        issues.push({ kind: 'spell', level: 'error', s: t.s, e: t.e, word: t.raw, msg: `拼写：${t.raw}`, fix: sug.join(' / ') })
      })
    }

    // Traps known for this sentence.
    for (const [pat, msg] of item.traps || []) {
      const alt = parseAlt(pat)
      const at = matchAlt(alt, ws, text)
      if (at) {
        const span = at.length ? { s: ws[Math.min(...at)].s, e: ws[Math.max(...at)].e } : {}
        issues.push(Object.assign({ kind: 'grammar', level: 'error', msg, trap: true }, span))
      }
    }

    if (!exact) {
      for (const g of grammar(toks, ws))
        issues.push(g)
      for (const g of patterns(text, toks))
        issues.push(g)
    }
    else if (toks.some(t => t.contr)) {
      issues.push({ kind: 'style', level: 'tip', msg: '正式写作一般不用缩写。', fix: 'do not / cannot / it is' })
    }

    // Meaning units.
    const keyRes = (item.keys || []).map((k) => {
      const key = typeof k === 'string' ? parseKey(k) : k
      const at = exact ? [] : matchKey(key, ws, text)
      if (at)
        at.forEach(i => marks.push({ s: ws[i].s, e: ws[i].e, cls: 'key' }))
      return { zh: key.zh, opt: key.opt, ok: !!at }
    })
    for (const k of keyRes) {
      if (!k.ok)
        issues.push({ kind: 'meaning', level: k.opt ? 'tip' : 'error', msg: k.opt ? `可以补上“${k.zh}”的意思。` : `没有译出“${k.zh}”。`, zh: k.zh })
    }

    // Negation that no reference has.
    const neg = ws.filter(t => /^(not|no|never|nor)$/.test(t.w))
    if (!exact && neg.length && refs.length && refs.every(r => !wordsOf(tokenize(r)).some(t => /^(not|no|never|nor)$/.test(t.w))) && !(item.keys || []).some(k => /\bnot\b|\bno\b|never/.test(String(k))))
      issues.push({ kind: 'meaning', level: 'error', s: neg[0].s, e: neg[0].e, msg: '多了否定词，意思和原句相反。' })

    if (text && !/[.!?]["']?$/.test(text))
      issues.push({ kind: 'style', level: 'tip', msg: '句末加句号。' })
    if (text && /^[a-z]/.test(text))
      issues.push({ kind: 'style', level: 'tip', msg: '句首字母大写。' })

    // Closest reference, for the word-by-word comparison.
    const aSt = ws.map(t => canonWord(t.st))
    let best = null
    for (const r of refs) {
      const rw = wordsOf(tokenize(r))
      const res = lcs(aSt, rw.map(t => canonWord(t.st)))
      const score = res.n / Math.max(rw.length, aSt.length, 1)
      if (!best || score > best.score)
        best = { ref: r, rw, res, score }
    }
    let refMarks = []
    if (best) {
      refMarks = best.rw.map((t, j) => ({ s: t.s, e: t.e, miss: !best.res.inB.has(j) }))
      ws.forEach((t, i) => {
        if (!best.res.inA.has(i))
          marks.push({ s: t.s, e: t.e, cls: 'extra' })
      })
    }
    for (const x of issues) {
      if (x.s != null)
        marks.push({ s: x.s, e: x.e, cls: x.kind === 'spell' ? 'spell' : x.level === 'error' ? 'bad' : 'warn' })
    }

    // One issue per span and message.
    const seen = new Set()
    const uniq = issues.filter((x) => {
      const k = `${x.msg}|${x.s}`
      if (seen.has(k))
        return false
      seen.add(k)
      return true
    })
    const errors = uniq.filter(x => x.level === 'error')
    const warns = uniq.filter(x => x.level === 'warn')
    const verdict = exact && !errors.length ? 'right' : errors.length ? 'wrong' : warns.length ? 'close' : 'right'
    const req = keyRes.filter(k => !k.opt)
    const okN = req.filter(k => k.ok).length
    const score = Math.max(0, Math.min(100, Math.round((req.length ? (okN / req.length) * 100 : 100) - 12 * errors.filter(x => x.kind !== 'meaning').length - 4 * warns.length)))
    return { verdict, exact, issues: uniq, keys: keyRes, keysOk: okN, keysTotal: req.length, ref: best ? best.ref : '', refMarks, marks, score, text }
  }

  /** Text split into spans for highlighting: [{ t, cls: [] }]. */
  function spans(text, marks) {
    const cuts = new Set([0, text.length])
    for (const m of marks) {
      cuts.add(Math.max(0, m.s))
      cuts.add(Math.min(text.length, m.e))
    }
    const pts = [...cuts].sort((a, b) => a - b)
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i]
      const e = pts[i + 1]
      out.push({ t: text.slice(s, e), cls: [...new Set(marks.filter(m => m.s <= s && m.e >= e).map(m => m.cls || (m.miss ? 'miss' : '')).filter(Boolean))] })
    }
    return out
  }

  return { tokenize, stem, setMacros, setDict, hasDict, setSpelling, parseKey, check, spans, expandRef, flat, forms, ppOf, pastOf, ingOf, third, distance, suggest }
})
