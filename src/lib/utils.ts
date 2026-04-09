import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function lines(t: string | undefined | null): string[] {
  return (t ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function getAge(dobStr: string): number | null {
  if (!dobStr) return null
  const m = String(dobStr).match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/)
  if (!m) return null
  let y: number, mo: number, d: number
  if (parseInt(m[1], 10) > 31) {
    y = parseInt(m[1], 10)
    mo = parseInt(m[2], 10)
    d = parseInt(m[3], 10)
  } else {
    mo = parseInt(m[1], 10)
    d = parseInt(m[2], 10)
    y = parseInt(m[3], 10)
  }
  if (y < 100) y += y < 50 ? 2000 : 1900
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < d)) age--
  return age >= 0 ? age : null
}

export interface FlyerData {
  theme: 'current' | 'ocean' | 'forest' | 'lavender'
  /** Data URL from optional profile photo upload; empty when unset */
  profilePhotoUrl: string
  preferredName: string
  dob: string
  gender: string
  aboutMe: string
  diagnoses: string
  allergiesAndReactions: string
  medications: string
  polstStatus: 'dnr' | 'selective' | 'no-nutrition' | 'omit'
  primaryContact: string
  primaryCarePhysician: string
  otherProviders: string
  address: string
  careValues: string[]
  dailyRoutine: string
  likesAndComforts: string
  dislikesAndTriggers: string
  personalBackground: string
  compactMode: boolean
}

export function buildSummary(data: FlyerData): string {
  const age = getAge(data.dob)
  const gender = data.gender
  const pref = data.preferredName.trim()
  const diag = lines(data.diagnoses)
  const aboutMe = data.aboutMe.trim()
  const background = data.personalBackground.trim()

  const intro: string[] = ['I am']
  if (age != null) intro.push(`a ${age} year old`)
  if (gender) intro.push(gender)
  const introStr = intro.join(' ')

  const rest: string[] = []
  if (pref) rest.push(`who goes by ${pref}`)

  let s = introStr + (rest.length ? ' ' + rest.join(' ') : '') + '.'

  if (diag.length) s += ` I am living with ${diag.join(', ')}.`
  if (aboutMe) s += ' ' + aboutMe + (aboutMe.endsWith('.') ? '' : '.')
  if (background) {
    const firstSentence = background.split(/[.!?]/)[0]?.trim()
    if (firstSentence) s += ' ' + firstSentence + '.'
  }

  return s.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim() || ''
}
