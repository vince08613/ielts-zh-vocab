/* Answer keys and marking for listening / reading answer sheets, band conversion, and the
   Section 1 information dictation generator. Pure functions (used by node tests too). */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).answers = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  /* ---------- normalising ---------- */

  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .replace(/[‘’`´]/g, '\'').replace(/[“”]/g, '"')
      .replace(/[‐-―−]/g, '-')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, '-')
      .trim()
      .replace(/[.,;:!?]+$/, '')
      .trim()
  }

  // British / American spellings: every form maps to one canonical form (the first British one).
  let spellCanon = new Map()
  function setSpelling(rows) {
    spellCanon = new Map()
    for (const r of rows || []) {
      const all = [...r.uk, ...r.us].map(norm)
      for (const f of all)
        spellCanon.set(f, all[0])
    }
  }
  const canonWord = w => spellCanon.get(w) || w
  const canonText = s => s.split(' ').map(canonWord).join(' ')

  // 1,500 -> 1500; £12.50 -> 12.50 (currency only before a number)
  const plainNumber = s => s.replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/^[£$€]\s*(?=\d)/, '')

  const TFNG = { t: 'true', f: 'false', ng: 'not given', y: 'yes', n: 'no' }

  /* ---------- answer keys ---------- */

  /** "(the) library" -> ["the library", "library"] */
  function expandOptional(s) {
    let out = [s]
    const re = /\(([^)]*)\)/
    while (out.some(x => re.test(x))) {
      out = out.flatMap((x) => {
        const m = x.match(re)
        if (!m)
          return [x]
        return [x.replace(re, m[1]), x.replace(re, '')]
      })
    }
    return [...new Set(out.map(x => norm(x)).filter(Boolean))]
  }

  const LINE = /^\s*(?:q(?:uestion)?\s*)?(\d{1,2})(?:\s*[-–~&和至]\s*(\d{1,2}))?\s*[.)、:：]?\s+(.+)$/i

  /**
   * Parse an answer key, one question per line (or separated by ";"):
   *   1 B
   *   2 (the) library            optional words in brackets
   *   3 23 October / October 23  alternatives separated by " / ", "|" or " OR "
   *   4-5 B, D                   two questions, answers in any order
   * Returns { items: [{ n, alts: [string], group, show }], errors: [line] }; show is the key as written.
   */
  function parseKey(text) {
    const items = []
    const errors = []
    let group = 0
    for (const raw of String(text || '').split(/\r?\n|;/)) {
      const line = raw.trim()
      if (!line)
        continue
      const m = line.match(LINE)
      if (!m) {
        errors.push(line)
        continue
      }
      const from = Number(m[1])
      const to = m[2] ? Number(m[2]) : from
      const body = m[3].trim()
      if (to < from || to - from > 4 || from < 1) {
        errors.push(line)
        continue
      }
      if (to > from) {
        // A range: the answers form one set, given in any order.
        const parts = body.split(/\s*[,，、/]\s*|\s+and\s+|\s+/i).filter(Boolean)
        if (parts.length !== to - from + 1) {
          errors.push(line)
          continue
        }
        group++
        const set = parts.map(norm)
        for (let n = from; n <= to; n++)
          items.push({ n, alts: set, group, show: `${parts.join(', ')}（顺序不限）` })
        continue
      }
      const alts = body.split(/\s+\/\s+|\s*\|\s*|\s+or\s+/i).flatMap(expandOptional)
      if (!alts.length) {
        errors.push(line)
        continue
      }
      items.push({ n: from, alts, group: 0, show: body })
    }
    // Later lines win over earlier ones for the same question number.
    const byN = new Map()
    for (const it of items)
      byN.set(it.n, it)
    return { items: [...byN.values()].sort((a, b) => a.n - b.n), errors }
  }

  /**
   * Compare one answer with one accepted form.
   * Returns '' (no match) | 'exact' | a note explaining a tolerated difference.
   */
  function match(answer, accepted) {
    const a = norm(answer)
    const k = norm(accepted)
    if (!a)
      return ''
    if (a === k)
      return 'exact'
    if (TFNG[a] && TFNG[a] === k)
      return '缩写也算对，考试时建议写全称'
    if (plainNumber(a) === plainNumber(k))
      return 'exact'
    if (canonText(a) === canonText(k))
      return '英美拼写都算对'
    if (a.replace(/-/g, ' ') === k.replace(/-/g, ' '))
      return '连字符写法不同，一般算对'
    return ''
  }

  /** Mark a whole sheet. answers: { [n]: string }. */
  function markSheet(key, answers) {
    const results = []
    const groups = new Map()
    for (const it of key.items) {
      if (it.group) {
        if (!groups.has(it.group))
          groups.set(it.group, [])
        groups.get(it.group).push(it)
        continue
      }
      const ans = answers[it.n] || ''
      let note = ''
      for (const alt of it.alts) {
        note = match(ans, alt)
        if (note)
          break
      }
      results.push({ n: it.n, answer: ans, expected: it.show || it.alts.join(' / '), ok: !!note, note: note === 'exact' ? '' : note })
    }
    // Any-order groups: each accepted letter counts once.
    for (const list of groups.values()) {
      const left = list[0].alts.slice()
      for (const it of list) {
        const ans = answers[it.n] || ''
        const i = left.findIndex(x => match(ans, x))
        if (i >= 0)
          left.splice(i, 1)
        results.push({ n: it.n, answer: ans, expected: it.show || list[0].alts.join(', '), ok: i >= 0, note: '' })
      }
    }
    results.sort((a, b) => a.n - b.n)
    return { results, score: results.filter(r => r.ok).length, total: results.length }
  }

  /**
   * Mark the built-in reading questions. groups: a passage's question groups;
   * answers: { [n]: string }. "Choose TWO" groups accept the letters in any order.
   */
  function markGroups(groups, answers) {
    const out = []
    const accept = (raw, alts) => {
      for (const alt of alts) {
        const m = match(raw, alt)
        if (m)
          return m
      }
      return ''
    }
    for (const g of groups) {
      if (g.type === 'multi') {
        const left = g.questions[0].answer.map(norm)
        for (const q of g.questions) {
          const i = left.indexOf(norm(answers[q.n]))
          if (i >= 0)
            left.splice(i, 1)
          out.push({ n: q.n, answer: answers[q.n] || '', expected: g.questions[0].answer.join(', '), ok: i >= 0, note: '' })
        }
        continue
      }
      for (const q of g.questions) {
        const raw = answers[q.n] || ''
        const m = accept(raw, q.answer)
        let note = m && m !== 'exact' ? m : ''
        if (!m && g.type === 'gap' && g.words && norm(raw).split(' ').filter(Boolean).length > g.words)
          note = `超过字数限制（最多 ${g.words} 个词）`
        out.push({ n: q.n, answer: raw, expected: q.answer.join(' / '), ok: !!m, note })
      }
    }
    return out.sort((a, b) => a.n - b.n)
  }

  /* ---------- band conversion ---------- */

  // Commonly published conversion tables. ielts.org gives the averages Listening 16/23/30/35
  // and Academic Reading 15/23/30/35 marks for bands 5/6/7/8; exact cut-offs vary by test version.
  const BANDS = {
    listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]],
    academic: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1]],
    general: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1]],
  }

  /** Band for a raw score; scores out of fewer than 40 are scaled up first. */
  function band(kind, score, total = 40) {
    const table = BANDS[kind]
    if (!table || !total)
      return null
    const raw = Math.round((score / total) * 40)
    for (const [min, b] of table) {
      if (raw >= min)
        return b
    }
    return 0
  }

  /* ---------- numbers in words (British usage) ---------- */

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  function numWords(n) {
    if (n < 20)
      return ONES[n]
    if (n < 100)
      return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
    if (n < 1000)
      return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${numWords(n % 100)}` : ''}`
    const rest = n % 1000
    return `${numWords(Math.floor(n / 1000))} thousand${rest ? (rest < 100 ? ' and ' : ' ') + numWords(rest) : ''}`
  }
  const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }
  function ordWords(n) {
    const w = numWords(n)
    const parts = w.split('-')
    const last = parts.pop()
    const o = ORD[last] || (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`)
    return [...parts, o].join('-')
  }
  const ordSuffix = n => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th')

  /* ---------- Section 1 dictation ---------- */

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const SURNAMES = ['Thornton', 'Mackenzie', 'Harrington', 'Fairclough', 'Whitmore', 'Ashworth', 'Pemberton', 'Lockwood', 'Kowalski', 'Gallagher', 'Rutherford', 'Blackwell', 'Henderson', 'Sullivan', 'Fitzgerald', 'Llewellyn', 'Cartwright', 'Stoddard']
  const STREETS = ['Wexford', 'Barnaby', 'Hollingsworth', 'Kingsley', 'Merriweather', 'Glenhaven', 'Peverell', 'Ashcombe', 'Quayside', 'Thistlewood', 'Bramwell', 'Fennimore']
  const STREET_TYPES = ['Road', 'Street', 'Avenue', 'Lane', 'Close', 'Crescent']
  const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXY'
  const KINDS = {
    phone: '电话号码', date: '日期', time: '时间', price: '价格', spell: '拼写姓名', street: '拼写街名', code: '编号 / 邮编', teen: 'teen 与 ty', number: '大数字',
  }

  const pick = (rand, list) => list[Math.floor(rand() * list.length)]
  const int = (rand, a, b) => a + Math.floor(rand() * (b - a + 1))

  /** Spoken digits in British style: 0 = oh, repeated digits = double / triple. */
  function sayDigits(s) {
    const name = d => (d === '0' ? 'oh' : ONES[Number(d)])
    const out = []
    for (let i = 0; i < s.length;) {
      let j = i
      while (j < s.length && s[j] === s[i])
        j++
      let run = j - i
      while (run > 0) {
        if (run >= 3 && run !== 4) {
          out.push(`triple ${name(s[i])}`)
          run -= 3
        }
        else if (run >= 2) {
          out.push(`double ${name(s[i])}`)
          run -= 2
        }
        else {
          out.push(name(s[i]))
          run -= 1
        }
      }
      i = j
    }
    return out.join(' ')
  }

  /** Spelled letters, with double letters said as "double L". */
  function sayLetters(word) {
    const up = word.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const out = []
    for (let i = 0; i < up.length; i++) {
      const ch = up[i]
      const say = /\d/.test(ch) ? ONES[Number(ch)] : ch
      if (up[i + 1] === ch) {
        out.push(`double ${say}`)
        i++
      }
      else {
        out.push(say)
      }
    }
    return out.join(', ')
  }

  function timeWords(h24, m) {
    const h = ((h24 + 11) % 12) + 1
    const next = (h % 12) + 1
    const part = h24 < 12 ? 'in the morning' : h24 < 18 ? 'in the afternoon' : 'in the evening'
    let say
    if (m === 0)
      say = `${numWords(h)} o'clock`
    else if (m === 30)
      say = `half past ${numWords(h)}`
    else if (m === 15)
      say = `a quarter past ${numWords(h)}`
    else if (m === 45)
      say = `a quarter to ${numWords(next)}`
    else if (m < 30)
      say = `${numWords(m)} past ${numWords(h)}`
    else
      say = `${numWords(60 - m)} to ${numWords(next)}`
    return `${say} ${part}`
  }

  /**
   * One dictation item: { kind, label, say, prompt, answer }.
   * say: the text read aloud; prompt: what the answer box asks for; answer: model answer.
   */
  function makeDictation(kind, rand) {
    const k = KINDS[kind] ? kind : pick(rand, Object.keys(KINDS))
    const item = { kind: k, label: KINDS[k] }
    if (k === 'phone') {
      const digits = `07${Array.from({ length: 9 }, () => int(rand, 0, 9)).join('')}`
      // Repeated digits make "double" / "oh" practice likely.
      const d = digits.split('')
      if (rand() < 0.7) {
        const i = int(rand, 2, 8)
        d[i + 1] = d[i]
      }
      const num = d.join('')
      const say = [num.slice(0, 5), num.slice(5, 8), num.slice(8)].map(sayDigits).join(', ')
      return Object.assign(item, { say: `Can I take a contact number? Yes, it's ${say}.`, prompt: 'Phone number', answer: num })
    }
    if (k === 'date') {
      const mi = int(rand, 0, 11)
      const day = int(rand, 1, MONTH_DAYS[mi])
      const spoken = rand() < 0.5 ? `the ${ordWords(day)} of ${MONTHS[mi]}` : `${MONTHS[mi]} the ${ordWords(day)}`
      return Object.assign(item, { say: `And when would you like to start? On ${spoken}, if that's possible.`, prompt: 'Start date', answer: `${day} ${MONTHS[mi]}`, day, month: mi })
    }
    if (k === 'time') {
      const h24 = pick(rand, [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20])
      const m = pick(rand, [0, 10, 15, 20, 30, 40, 45, 50])
      return Object.assign(item, { say: `The coach leaves at ${timeWords(h24, m)}, so please arrive ten minutes early.`, prompt: 'Departure time', answer: `${((h24 + 11) % 12) + 1}:${String(m).padStart(2, '0')}`, minutes: h24 * 60 + m })
    }
    if (k === 'price') {
      const pounds = pick(rand, [int(rand, 3, 19), int(rand, 20, 99), int(rand, 100, 450)])
      const pence = pick(rand, [0, 0, 50, 99, 25, 75, 45])
      const say = `${numWords(pounds)} pound${pounds === 1 ? '' : 's'}${pence ? ` ${numWords(pence)}` : ''}`
      return Object.assign(item, { say: `The total cost comes to ${say}.`, prompt: 'Total cost (£)', answer: `£${pounds}${pence ? `.${String(pence).padStart(2, '0')}` : ''}`, value: pounds * 100 + pence })
    }
    if (k === 'spell') {
      const name = pick(rand, SURNAMES)
      return Object.assign(item, { say: `My surname is ${name}. That's ${sayLetters(name)}.`, prompt: 'Surname', answer: name })
    }
    if (k === 'street') {
      const name = pick(rand, STREETS)
      const type = pick(rand, STREET_TYPES)
      const no = int(rand, 2, 98)
      return Object.assign(item, { say: `The address is ${numWords(no)} ${name} ${type}. ${name} is spelt ${sayLetters(name)}.`, prompt: 'Address', answer: `${no} ${name} ${type}` })
    }
    if (k === 'code') {
      const postcode = rand() < 0.5
      const code = postcode
        ? `${pick(rand, LETTERS)}${pick(rand, LETTERS)}${int(rand, 1, 9)} ${int(rand, 1, 9)}${pick(rand, LETTERS)}${pick(rand, LETTERS)}`
        : `${pick(rand, LETTERS)}${pick(rand, LETTERS)}${int(rand, 1, 9)}${int(rand, 0, 9)}${int(rand, 0, 9)}${pick(rand, LETTERS)}`
      const say = sayLetters(code)
      return Object.assign(item, { say: postcode ? `And the postcode is ${say}.` : `Your booking reference is ${say}.`, prompt: postcode ? 'Postcode' : 'Booking reference', answer: code })
    }
    if (k === 'teen') {
      const base = int(rand, 3, 9)
      const n = rand() < 0.5 ? 10 + base : base * 10
      const tpl = pick(rand, [
        x => [`The class has ${x} students at the moment.`, 'Number of students'],
        x => [`It's room ${x}, on the second floor.`, 'Room number'],
        x => [`The tour lasts about ${x} minutes.`, 'Length of tour (minutes)'],
        x => [`We need ${x} chairs for the meeting.`, 'Number of chairs'],
      ])
      const [say, prompt] = tpl(numWords(n))
      return Object.assign(item, { say, prompt, answer: String(n) })
    }
    const n = pick(rand, [int(rand, 1100, 9900), int(rand, 1000, 1099), int(rand, 120, 990)])
    return Object.assign(item, { say: `Last year the festival had around ${numWords(n)} visitors.`, prompt: 'Number of visitors', answer: String(n) })
  }

  const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/
  const monthIndex = m => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m.slice(0, 3))
  // 15 and 50 share the base 5: the classic teen / ty confusion.
  const teenBase = x => (x >= 13 && x <= 19 ? x - 10 : x >= 30 && x <= 90 && x % 10 === 0 ? x / 10 : null)

  /** { ok, note } for a dictation answer. */
  function judgeDictation(item, answer) {
    const a = norm(answer)
    if (!a)
      return { ok: false, note: '未作答' }
    const k = item.kind
    if (k === 'phone' || k === 'teen' || k === 'number') {
      const digits = a.replace(/[^0-9]/g, '')
      if (digits === item.answer.replace(/[^0-9]/g, ''))
        return { ok: true, note: /[a-z]/.test(a) ? '数字建议直接写阿拉伯数字' : '' }
      if (k === 'teen' && digits && teenBase(Number(digits)) != null && teenBase(Number(digits)) === teenBase(Number(item.answer)))
        return { ok: false, note: 'teen 和 ty 听混了：-teen 重音在后、尾音长；-ty 重音在前、尾音短促' }
      return { ok: false, note: k === 'phone' ? '注意 oh = 0，double = 两个相同数字' : '' }
    }
    if (k === 'date') {
      const m = a.match(MONTH_RE)
      const d = a.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/)
      if (!m)
        return { ok: false, note: /\d+\s*[/.-]\s*\d+/.test(a) ? '日期不要写成纯数字（3/4 在英美含义不同），写成 21 March' : '没有写月份' }
      const ok = monthIndex(m[1]) === item.month && d && Number(d[1]) === item.day
      return { ok, note: ok ? '' : '日或月不对' }
    }
    if (k === 'time') {
      const m = a.replace(/\s/g, '').match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm|a\.m\.?|p\.m\.?)?$/)
      if (!m)
        return { ok: false, note: '时间写成 7:30 或 7.30' }
      let h = Number(m[1])
      const min = Number(m[2] || 0)
      const want = item.minutes
      if (m[3]) {
        const pm = m[3].startsWith('p')
        h = (h % 12) + (pm ? 12 : 0)
        return { ok: h * 60 + min === want, note: '' }
      }
      const ok = min === want % 60 && (h % 12 === Math.floor(want / 60) % 12 || h === Math.floor(want / 60))
      return { ok, note: ok ? '' : 'half past = 半点，a quarter to = 差一刻' }
    }
    if (k === 'price') {
      const m = a.replace(/,/g, '').match(/(\d+)(?:\.(\d{1,2}))?/)
      if (!m)
        return { ok: false, note: '价格写数字，例如 £12.50' }
      const value = Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0)
      return { ok: value === item.value, note: value === item.value ? '' : '注意“几镑几便士”的读法：twelve pounds fifty = £12.50' }
    }
    if (k === 'street') {
      const want = norm(item.answer).replace(/\b(road|street|avenue|lane|close|crescent)$/, '').trim()
      const got = a.replace(/\b(road|rd|street|st|avenue|ave|lane|ln|close|crescent|cres)$/, '').trim()
      if (got === want)
        return { ok: true, note: '' }
      return { ok: false, note: got.split(' ')[0] === want.split(' ')[0] ? '门牌号对了，街名拼写有误' : '门牌号或街名有误' }
    }
    const want = norm(item.answer).replace(/\s/g, '')
    const got = a.replace(/\s/g, '')
    return { ok: got === want, note: got === want ? '' : (k === 'spell' ? '注意 double 表示两个相同字母' : '') }
  }

  return { norm, setSpelling, parseKey, match, markSheet, markGroups, band, BANDS, numWords, ordWords, ordSuffix, sayDigits, sayLetters, makeDictation, judgeDictation, KINDS }
})
