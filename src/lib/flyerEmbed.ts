import { INITIAL_FLYER_DATA, type FlyerData } from '@/lib/utils'

/**
 * Exported PDFs are flat images, so the form data is also stored in the PDF
 * Keywords field. Re-importing a flyer we exported is then exact instead of
 * relying on OCR.
 */
export const FLYER_DATA_PREFIX = 'patient-flyer-data:v1:'

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeFlyerData(data: FlyerData): string {
  return FLYER_DATA_PREFIX + utf8ToBase64(JSON.stringify(data))
}

/** Returns null when the string carries no (valid) embedded flyer data. */
export function decodeFlyerData(raw: string | undefined | null): FlyerData | null {
  if (!raw) return null
  const start = raw.indexOf(FLYER_DATA_PREFIX)
  if (start < 0) return null
  try {
    const payload = raw.slice(start + FLYER_DATA_PREFIX.length).trim()
    return sanitizeFlyerData(JSON.parse(base64ToUtf8(payload)))
  } catch {
    return null
  }
}

/** Copy only known keys with the expected types onto a blank flyer. */
export function sanitizeFlyerData(input: unknown): FlyerData {
  const out: FlyerData = { ...INITIAL_FLYER_DATA }
  if (!input || typeof input !== 'object') return out
  const src = input as Record<string, unknown>
  const target = out as unknown as Record<string, unknown>

  for (const key of Object.keys(INITIAL_FLYER_DATA) as (keyof FlyerData)[]) {
    const value = src[key]
    const fallback = INITIAL_FLYER_DATA[key]
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) {
        target[key] = value.filter((v): v is string => typeof v === 'string')
      }
    } else if (typeof value === typeof fallback) {
      target[key] = value
    }
  }

  if (!['current', 'ocean', 'forest', 'lavender'].includes(out.theme)) {
    out.theme = 'current'
  }
  if (!['dnr', 'selective', 'no-nutrition', 'omit'].includes(out.polstStatus)) {
    out.polstStatus = 'omit'
  }
  if (out.profilePhotoUrl && !out.profilePhotoUrl.startsWith('data:image/')) {
    out.profilePhotoUrl = ''
  }
  return out
}
