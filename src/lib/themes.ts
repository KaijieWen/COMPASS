import type { FlyerData } from '@/lib/utils'

export type FlyerThemeId = FlyerData['theme']

export const FLYER_THEMES: {
  id: FlyerThemeId
  label: string
  /** paper, accent-light, accent, day-1 */
  preview: [string, string, string, string]
}[] = [
  {
    id: 'current',
    label: 'Warm (Peach/Tan)',
    preview: ['#EFE5DB', '#efe3d8', '#E1A185', '#f0d8c7'],
  },
  {
    id: 'ocean',
    label: 'Cool (Ocean Blue)',
    preview: ['#e8f4f8', '#e0f2f7', '#5a9fb8', '#b8e0ec'],
  },
  {
    id: 'forest',
    label: 'Natural (Forest Green)',
    preview: ['#eef5eb', '#e8f0e4', '#5a8f5a', '#c5e0b8'],
  },
  {
    id: 'lavender',
    label: 'Calm (Soft Lavender)',
    preview: ['#f5f0f8', '#f0e8f5', '#8b7a9e', '#e0d4ec'],
  },
]

export function getFlyerTheme(id: FlyerThemeId) {
  return FLYER_THEMES.find((t) => t.id === id) ?? FLYER_THEMES[0]
}
