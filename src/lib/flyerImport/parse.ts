import {
  buildSummary,
  CARE_VALUES,
  GENDER_OPTIONS,
  INITIAL_FLYER_DATA,
  POLST_LABELS,
  type FlyerData,
} from '@/lib/utils'
import { makeLine, type TextLine, type TextWord } from './types'

/*
 * Layout constants in CSS px, mirrored from the .flyer-* rules in index.css.
 * The parser leans on them to tell a wrapped line from a new list item and to
 * split the two-column Personal Details grid and the providers table.
 */
const PAGE_PADDING = 28.8 // 0.3in
const SECTION_INSET = 15 // 1px border + 14px padding
const CONTENT_LEFT = PAGE_PADDING + SECTION_INSET
const CONTENT_RIGHT = 816 - CONTENT_LEFT
const GRID_MID = 408
/** Extra room (px) tolerated before deciding a line ended on purpose */
const WRAP_SLACK = 14
/** Horizontal gap (px) separating two items of the inline medications list */
const INLINE_ITEM_GAP = 10
/** Vertical pitch (px) above which a providers-table line starts a new row */
const TABLE_ROW_PITCH = 23
/** Name in the header is 18–24pt; everything else is ≤12pt */
const NAME_MIN_HEIGHT = 15

export const SECTION_HEADINGS: { id: string; title: string }[] = [
  { id: 'lifeContext', title: 'Life Context / Recent Changes' },
  { id: 'diagnoses', title: 'Diagnoses' },
  { id: 'personalDetails', title: 'Personal Details' },
  { id: 'values', title: 'Values and Preferences' },
  { id: 'typicalDay', title: 'Typical Day' },
  { id: 'medical', title: 'Additional Medical Information' },
  { id: 'personalBackground', title: 'Personal Background' },
  { id: 'likes', title: 'Likes & What Helps Calm' },
  { id: 'dislikes', title: 'Dislikes & Triggers to Avoid' },
  { id: 'providers', title: 'Other Healthcare Providers' },
]

// List markers as OCR tends to read them. Dashes are excluded on purpose:
// "Penicillin – causes hives" uses a standalone en dash as content.
const BULLET_RE = /^[•·∙●○◦▪■*°«»¢©®eo]$/
/** OCR also reads "•" as a dash; only trusted as a bullet where an item starts */
const DASH_RE = /^[-–—]$/

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[b.length]
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function clean(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .trim()
}

function joinWords(words: TextWord[]): string {
  return clean(words.map((w) => w.text).join(' '))
}

function joinLines(lines: TextLine[]): string {
  return clean(lines.map((l) => l.text).join(' '))
}

function isBullet(text: string): boolean {
  return BULLET_RE.test(text)
}

function hasContent(text: string): boolean {
  return /[a-z0-9]/i.test(text)
}

function bestMatch<T extends string>(
  text: string,
  options: readonly T[],
  threshold: number
): T | null {
  const n = normalize(text)
  let best: T | null = null
  let bestScore = 0
  for (const option of options) {
    const score = similarity(n, normalize(option))
    if (score > bestScore) {
      best = option
      bestScore = score
    }
  }
  return bestScore >= threshold ? best : null
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/**
 * Merge visually wrapped lines back into logical items. A line continues the
 * previous one only when the previous line ran out of room for this line's
 * first word; otherwise (or after a bullet marker) it starts a new item.
 * A finished sentence followed by a "Label:" word (e.g. "Midday:") also starts
 * a new item, since that case often lands close to the right edge.
 */
function groupWrapped(lines: TextLine[], right = CONTENT_RIGHT): string[] {
  const items: TextWord[][] = []
  let prev: TextLine | null = null

  for (const line of lines) {
    let words = line.words
    let startsNew = prev === null
    if (words.length && isBullet(words[0].text)) {
      words = words.slice(1)
      startsNew = true
    }
    if (!words.length) continue
    if (!startsNew && prev) {
      const firstWordWidth = words[0].x1 - words[0].x0
      startsNew =
        right - prev.x1 > firstWordWidth + WRAP_SLACK ||
        (/[.!?]$/.test(prev.text) && /^[A-Z][a-z]*:$/.test(words[0].text))
    }
    if (startsNew && words.length > 1 && DASH_RE.test(words[0].text)) {
      words = words.slice(1)
    }
    if (startsNew || !items.length) items.push([])
    items[items.length - 1].push(...words)
    prev = line
  }

  return items.map(joinWords).filter(hasContent)
}

/**
 * Split a flex-wrapped inline list ("• A   • B   • C") into items, using the
 * bullet tokens and the wide gaps between items.
 */
function splitInlineList(lines: TextLine[]): string[] {
  const items: TextWord[][] = []
  let prevLine: TextLine | null = null

  for (const line of lines) {
    let prevWord: TextWord | null = null
    for (const word of line.words) {
      if (isBullet(word.text)) {
        items.push([])
        prevWord = word
        continue
      }
      let startsNew = items.length === 0
      if (!startsNew && prevWord) {
        startsNew = word.x0 - prevWord.x1 > INLINE_ITEM_GAP
      } else if (!startsNew && prevLine) {
        const width = word.x1 - word.x0
        startsNew = CONTENT_RIGHT - prevLine.x1 > width + WRAP_SLACK
      }
      if (startsNew) {
        items.push([])
        if (DASH_RE.test(word.text)) {
          prevWord = word
          continue
        }
      }
      items[items.length - 1].push(word)
      prevWord = word
    }
    prevLine = line
  }

  return items.map(joinWords).filter(hasContent)
}

/** Split "A, B, C" (how comma-joined fields render) into one item per line. */
function splitCommaList(text: string): string[] {
  return text
    .split(/\s*[,;]\s*/)
    .map(clean)
    .filter(hasContent)
}

interface LabelMatch {
  label: string
  rest: TextWord[]
}

/** Detect a "Label:" prefix (fuzzy, OCR-tolerant) at the start of a line. */
function matchLabelAtStart(words: TextWord[], labels: string[]): LabelMatch | null {
  if (!words.length) return null

  // OCR sometimes glues the value onto the label ("DOB:03/15/1935").
  const tokens = [...words]
  const glued = tokens[0].text.match(/^([^:]+:)(.+)$/)
  if (glued) {
    const w = tokens[0]
    const splitX = w.x0 + ((w.x1 - w.x0) * glued[1].length) / w.text.length
    tokens.splice(
      0,
      1,
      { ...w, text: glued[1], x1: splitX },
      { ...w, text: glued[2], x0: splitX }
    )
  }

  const sortedLabels = [...labels].sort(
    (a, b) => normalize(b).split(' ').length - normalize(a).split(' ').length
  )

  for (const label of sortedLabels) {
    const target = normalize(label)
    const need = target.split(' ').length
    const parts: string[] = []
    let consumed = 0
    while (consumed < tokens.length && parts.length < need) {
      const n = normalize(tokens[consumed].text)
      if (n) parts.push(n)
      consumed++
    }
    if (parts.length < need) continue
    const lastToken = tokens[consumed - 1].text
    const hasColon = /[:;]$/.test(lastToken)
    const score = similarity(parts.join(' '), target)
    if (score >= 0.8 || (hasColon && score >= 0.6)) {
      return { label, rest: tokens.slice(consumed) }
    }
  }
  return null
}

/** Group lines under the most recent "Label:" seen. */
function splitByLabels(lines: TextLine[], labels: string[]): Map<string, TextLine[]> {
  const fields = new Map<string, TextLine[]>()
  let current: string | null = null
  for (const line of lines) {
    const match = matchLabelAtStart(line.words, labels)
    if (match) {
      current = match.label
      if (!fields.has(current)) fields.set(current, [])
      if (match.rest.length) fields.get(current)!.push(makeLine(line.page, match.rest))
    } else if (current) {
      fields.get(current)!.push(line)
    }
  }
  return fields
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

interface ParseContext {
  data: FlyerData
  warnings: string[]
}

function parseHeader(lines: TextLine[], ctx: ParseContext) {
  const nameWords: TextWord[] = []
  for (const line of lines) {
    const dobIndex = line.words.findIndex((w) => /^d[o0]b\b/i.test(w.text))
    if (dobIndex >= 0) {
      const dobMatch = matchLabelAtStart(line.words.slice(dobIndex), ['DOB'])
      const dob = dobMatch ? joinWords(dobMatch.rest) : ''
      if (dob && hasContent(dob)) ctx.data.dob = dob
      nameWords.push(...line.words.slice(0, dobIndex))
      continue
    }

    const genderIndex = line.words.findIndex((w) => /^gender/i.test(w.text))
    if (genderIndex >= 0) {
      const match = matchLabelAtStart(line.words.slice(genderIndex), ['Gender'])
      if (match) setGender(joinWords(match.rest), ctx)
      continue
    }

    if (line.y1 - line.y0 >= NAME_MIN_HEIGHT) nameWords.push(...line.words)
  }

  const name = joinWords(nameWords)
  if (name && normalize(name) !== 'patient name') ctx.data.preferredName = name
}

function setGender(raw: string, ctx: ParseContext) {
  if (!hasContent(raw)) return
  const match = bestMatch(raw, GENDER_OPTIONS, 0.6)
  if (match) {
    ctx.data.gender = match
  } else {
    ctx.warnings.push(`Gender "${raw}" didn't match a form option — please pick one.`)
  }
}

function parsePersonalDetails(lines: TextLine[], ctx: ParseContext) {
  const labels = ['DOB', 'Gender', 'Primary Contact', 'PCP', 'Address']
  const left: TextLine[] = []
  const right: TextLine[] = []
  let spanning = false

  // The grid has two columns; only Primary Contact spans both.
  for (const line of lines) {
    const leftWords = line.words.filter((w) => w.x0 < GRID_MID)
    const rightWords = line.words.filter((w) => w.x0 >= GRID_MID)
    const match = matchLabelAtStart(leftWords, labels)
    if (match) spanning = match.label === 'Primary Contact'

    if (spanning || !rightWords.length) {
      left.push(line)
    } else {
      if (leftWords.length) left.push(makeLine(line.page, leftWords))
      right.push(makeLine(line.page, rightWords))
    }
  }

  const fields = new Map<string, TextLine[]>()
  for (const stream of [left, right]) {
    for (const [label, fieldLines] of splitByLabels(stream, labels)) {
      fields.set(label, [...(fields.get(label) ?? []), ...fieldLines])
    }
  }

  const dob = joinLines(fields.get('DOB') ?? [])
  if (dob && !ctx.data.dob) ctx.data.dob = dob
  const gender = joinLines(fields.get('Gender') ?? [])
  if (gender && !ctx.data.gender) setGender(gender, ctx)

  const contacts = groupWrapped(fields.get('Primary Contact') ?? [])
  if (contacts.length) ctx.data.primaryContact = contacts.join('\n')

  const pcp = joinLines(fields.get('PCP') ?? [])
  if (pcp) ctx.data.primaryCarePhysician = pcp

  const address = joinLines(fields.get('Address') ?? [])
  if (address) ctx.data.address = address
}

function parseValues(lines: TextLine[], ctx: ParseContext) {
  const tokens = normalize(joinLines(lines)).split(' ')
  const found: { value: string; index: number }[] = []

  for (const value of CARE_VALUES) {
    const target = normalize(value)
    const size = target.split(' ').length
    for (let i = 0; i + size <= tokens.length; i++) {
      if (similarity(tokens.slice(i, i + size).join(' '), target) >= 0.8) {
        found.push({ value, index: i })
        break
      }
    }
  }

  ctx.data.careValues = found.sort((a, b) => a.index - b.index).map((f) => f.value)
}

function parseMedical(lines: TextLine[], ctx: ParseContext) {
  const labels = ['Medications', 'Allergies / Adverse Reactions', 'POLST']
  const fields = splitByLabels(lines, labels)

  const meds = splitInlineList(fields.get('Medications') ?? [])
  if (meds.length) ctx.data.medications = meds.join('\n')

  const allergies = splitCommaList(joinLines(fields.get('Allergies / Adverse Reactions') ?? []))
  if (allergies.length) ctx.data.allergiesAndReactions = allergies.join('\n')

  const polstText = joinLines(fields.get('POLST') ?? [])
  if (polstText) {
    const entries = Object.entries(POLST_LABELS)
    const label = bestMatch(polstText, entries.map(([, l]) => l), 0.6)
    const key = entries.find(([, l]) => l === label)?.[0]
    if (key) {
      ctx.data.polstStatus = key as FlyerData['polstStatus']
    } else {
      ctx.warnings.push(`Couldn't read the POLST status ("${polstText}") — please re-select it.`)
    }
  }
}

function parseProviders(lines: TextLine[], ctx: ParseContext) {
  const width = CONTENT_RIGHT - CONTENT_LEFT
  let bounds = [CONTENT_LEFT + width / 3, CONTENT_LEFT + (2 * width) / 3]

  // Skip the "Name | Specialty | Contact" header and use it for column bounds
  const headerIndex = lines.findIndex((l) => {
    const n = normalize(l.text)
    return n.includes('name') && (n.includes('special') || n.includes('contact'))
  })
  if (headerIndex >= 0) {
    const header = lines[headerIndex]
    const spec = header.words.find((w) => similarity(normalize(w.text), 'specialty') >= 0.7)
    const contact = header.words.find((w) => similarity(normalize(w.text), 'contact') >= 0.7)
    if (spec && contact) bounds = [spec.x0 - 10, contact.x0 - 10]
  }

  const rows: TextWord[][][] = []
  let prev: TextLine | null = null
  for (const line of lines.slice(headerIndex + 1)) {
    const mid = (line.y0 + line.y1) / 2
    const prevMid = prev ? (prev.y0 + prev.y1) / 2 : -Infinity
    if (!rows.length || line.page !== prev?.page || mid - prevMid > TABLE_ROW_PITCH) {
      rows.push([[], [], []])
    }
    const row = rows[rows.length - 1]
    for (const w of line.words) {
      row[w.x0 < bounds[0] ? 0 : w.x0 < bounds[1] ? 1 : 2].push(w)
    }
    prev = line
  }

  const out = rows
    .map((cells) => cells.map(joinWords))
    .filter((cells) => cells.some(hasContent))
    .map((cells) => cells.join(' | ').replace(/(\s*\|\s*)+$/, ''))
  if (out.length) ctx.data.otherProviders = out.join('\n')
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface ParseHints {
  theme?: FlyerData['theme']
  profilePhotoUrl?: string
  compactMode?: boolean
}

export interface ParseResult {
  data: FlyerData
  warnings: string[]
  sectionsFound: string[]
}

function matchHeading(line: TextLine, used: Set<string>): string | null {
  const n = normalize(line.text)
  if (!n || n.length > 45) return null
  for (const h of SECTION_HEADINGS) {
    if (used.has(h.id)) continue
    if (similarity(n, normalize(h.title)) >= 0.8) return h.id
  }
  return null
}

export function parseFlyerLines(allLines: TextLine[], hints: ParseHints = {}): ParseResult {
  const ctx: ParseContext = {
    data: { ...INITIAL_FLYER_DATA, careValues: [], sectionOrder: [] },
    warnings: [],
  }
  if (hints.theme) ctx.data.theme = hints.theme
  if (hints.profilePhotoUrl) ctx.data.profilePhotoUrl = hints.profilePhotoUrl
  if (hints.compactMode !== undefined) ctx.data.compactMode = hints.compactMode

  const lines = allLines
    .filter((l) => hasContent(l.text))
    .sort((a, b) => a.page - b.page || a.y0 - b.y0)

  // Bucket lines into header + sections, dropping the "Generated:" footer
  const header: TextLine[] = []
  const sections = new Map<string, TextLine[]>()
  const used = new Set<string>()
  let current: string | null = null
  let footerPage = -1

  for (const line of lines) {
    if (/^generated\b/.test(normalize(line.text))) {
      footerPage = line.page
      continue
    }
    if (line.page === footerPage) continue

    const heading = matchHeading(line, used)
    if (heading) {
      used.add(heading)
      current = heading
      sections.set(heading, [])
      continue
    }
    if (current) sections.get(current)!.push(line)
    else if (line.page === 0) header.push(line)
  }

  if (!sections.size) {
    ctx.warnings.push(
      "Couldn't find any flyer section headings. Is this a flyer downloaded from this app?"
    )
  }

  parseHeader(header, ctx)

  for (const [id, sectionLines] of sections) {
    switch (id) {
      case 'lifeContext':
        ctx.data.aboutMe = joinLines(sectionLines)
        break
      case 'diagnoses':
        ctx.data.diagnoses = splitCommaList(joinLines(sectionLines)).join('\n')
        break
      case 'personalDetails':
        parsePersonalDetails(sectionLines, ctx)
        break
      case 'values':
        parseValues(sectionLines, ctx)
        break
      case 'typicalDay':
        ctx.data.dailyRoutine = groupWrapped(sectionLines).join('\n')
        break
      case 'medical':
        parseMedical(sectionLines, ctx)
        break
      case 'personalBackground':
        ctx.data.personalBackground = joinLines(sectionLines)
        break
      case 'likes':
        ctx.data.likesAndComforts = groupWrapped(sectionLines).join('\n')
        break
      case 'dislikes':
        ctx.data.dislikesAndTriggers = groupWrapped(sectionLines).join('\n')
        break
      case 'providers':
        parseProviders(sectionLines, ctx)
        break
    }
  }

  // With "About Me" blank the flyer shows an auto-generated summary instead.
  // Don't carry that summary into About Me; it is rebuilt from the other fields.
  if (ctx.data.aboutMe) {
    const summary = buildSummary({ ...ctx.data, aboutMe: '' })
    if (similarity(normalize(summary), normalize(ctx.data.aboutMe)) >= 0.85) {
      ctx.data.aboutMe = ''
    }
  }

  const sectionsFound = [...sections.keys()]
  ctx.data.sectionOrder = sectionsFound
  return { data: ctx.data, warnings: ctx.warnings, sectionsFound }
}
