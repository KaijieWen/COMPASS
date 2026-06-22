/** Letter-size page dimensions at 96 CSS px per inch. */
export const PAGE_WIDTH_PX = 8.5 * 96
export const PAGE_HEIGHT_PX = 11 * 96

/** Small buffer to account for sub-pixel rounding during export. */
export const LAYOUT_SAFETY_MARGIN_PX = 8

export const MAX_FLYER_PAGES = 2

export const SECTION_LABELS: Record<string, string> = {
  lifeContext: 'Life Context / Recent Changes',
  diagnoses: 'Diagnoses',
  personalDetails: 'Personal Details',
  values: 'Values and Preferences',
  typicalDay: 'Typical Day',
  medical: 'Additional Medical Information',
  personalBackground: 'Personal Background',
  likes: 'Likes & What Helps Calm',
  dislikes: 'Dislikes & Triggers to Avoid',
  providers: 'Other Healthcare Providers',
}

export type LayoutIssueType =
  | 'page_overflow'
  | 'section_too_tall'
  | 'exceeds_max_pages'

export interface LayoutIssue {
  type: LayoutIssueType
  sectionId?: string
  sectionLabel?: string
  pageIndex?: number
  message: string
}

export interface PageBudgets {
  page1ContentHeight: number
  page2ContentHeight: number
}

export interface SectionHeightMap {
  [sectionId: string]: number
}

export function getSectionLabel(sectionId: string): string {
  return SECTION_LABELS[sectionId] ?? sectionId
}

/**
 * Greedy bin-packing: place sections in order across up to MAX_FLYER_PAGES.
 * Sections are atomic — never split across pages.
 */
export function paginateSections(
  orderedSectionIds: string[],
  sectionHeights: SectionHeightMap,
  budgets: PageBudgets,
  compactMode: boolean
): string[][] {
  if (orderedSectionIds.length === 0) return [[]]

  if (compactMode) {
    return [orderedSectionIds]
  }

  const pages: string[][] = [[]]
  let currentPage = 0
  let usedHeight = 0

  const pageBudget = (pageIndex: number) =>
    pageIndex === 0 ? budgets.page1ContentHeight : budgets.page2ContentHeight

  for (const sectionId of orderedSectionIds) {
    const height = sectionHeights[sectionId] ?? 0
    const budget = pageBudget(currentPage)

    if (usedHeight + height > budget && pages[currentPage].length > 0) {
      if (currentPage >= MAX_FLYER_PAGES - 1) {
        pages[currentPage].push(sectionId)
        usedHeight += height
        continue
      }
      currentPage++
      pages.push([])
      usedHeight = 0
    }

    pages[currentPage].push(sectionId)
    usedHeight += height
  }

  return pages
}

/**
 * Analyze a paginated layout and return actionable issues.
 */
export function analyzeLayout(
  pageGroups: string[][],
  sectionHeights: SectionHeightMap,
  budgets: PageBudgets,
  compactMode: boolean
): LayoutIssue[] {
  const issues: LayoutIssue[] = []

  const page1MaxSectionHeight = budgets.page1ContentHeight
  const page2MaxSectionHeight = budgets.page2ContentHeight
  const singlePageMax = compactMode
    ? budgets.page1ContentHeight
    : Math.max(page1MaxSectionHeight, page2MaxSectionHeight)

  for (const [sectionId, height] of Object.entries(sectionHeights)) {
    if (height > singlePageMax) {
      issues.push({
        type: 'section_too_tall',
        sectionId,
        sectionLabel: getSectionLabel(sectionId),
        message: `"${getSectionLabel(sectionId)}" is too long to fit on one page. Shorten the text in the form.`,
      })
    }
  }

  pageGroups.forEach((sectionIds, pageIndex) => {
    const budget =
      pageIndex === 0 ? budgets.page1ContentHeight : budgets.page2ContentHeight
    const totalHeight = sectionIds.reduce(
      (sum, id) => sum + (sectionHeights[id] ?? 0),
      0
    )

    if (totalHeight > budget) {
      const overflowingIds = findOverflowingSectionsOnPage(
        sectionIds,
        sectionHeights,
        budget
      )
      for (const sectionId of overflowingIds) {
        if (issues.some((i) => i.sectionId === sectionId && i.type === 'section_too_tall')) {
          continue
        }
        issues.push({
          type: 'page_overflow',
          sectionId,
          sectionLabel: getSectionLabel(sectionId),
          pageIndex,
          message:
            pageIndex === 0
              ? `Page 1 is too full — drag "${getSectionLabel(sectionId)}" to page 2 using the grip handle.`
              : `Page 2 is too full — shorten text in "${getSectionLabel(sectionId)}" or remove content.`,
        })
      }
    }
  })

  if (!compactMode && pageGroups.length > MAX_FLYER_PAGES) {
    const overflowSections = pageGroups.slice(MAX_FLYER_PAGES).flat()
    issues.push({
      type: 'exceeds_max_pages',
      message: `Too much content for ${MAX_FLYER_PAGES} pages. Shorten or remove sections: ${overflowSections.map(getSectionLabel).join(', ')}.`,
    })
  }

  if (!compactMode) {
    const page2Budget = budgets.page2ContentHeight
    let simulatedPage2Height = 0
    const page2Sections = pageGroups[1] ?? []
    const wouldOverflowPage2: string[] = []

    for (const sectionId of page2Sections) {
      const height = sectionHeights[sectionId] ?? 0
      if (simulatedPage2Height + height > page2Budget && page2Sections.length > 0) {
        wouldOverflowPage2.push(sectionId)
      }
      simulatedPage2Height += height
    }

    if (pageGroups.length === MAX_FLYER_PAGES && simulatedPage2Height > page2Budget) {
      const extraFromPacking = pageGroups[1]?.filter((id) => {
        const idx = pageGroups[1]!.indexOf(id)
        let h = 0
        for (let i = 0; i <= idx; i++) {
          h += sectionHeights[pageGroups[1]![i]] ?? 0
        }
        return h > page2Budget
      })

      if (extraFromPacking && extraFromPacking.length > 0) {
        const sectionsNeedingPage3 = getSectionsBeyondBudget(
          pageGroups[1] ?? [],
          sectionHeights,
          page2Budget
        )
        if (sectionsNeedingPage3.length > 0) {
          const alreadyReported = issues.some((i) => i.type === 'exceeds_max_pages')
          if (!alreadyReported) {
            issues.push({
              type: 'exceeds_max_pages',
              message: `Too much content for ${MAX_FLYER_PAGES} pages. Shorten or remove: ${sectionsNeedingPage3.map(getSectionLabel).join(', ')}.`,
            })
            for (const sectionId of sectionsNeedingPage3) {
              if (!issues.some((i) => i.sectionId === sectionId)) {
                issues.push({
                  type: 'page_overflow',
                  sectionId,
                  sectionLabel: getSectionLabel(sectionId),
                  pageIndex: 1,
                  message: `"${getSectionLabel(sectionId)}" does not fit on page 2. Shorten the text or drag other sections to page 1.`,
                })
              }
            }
          }
        }
      }
    }
  }

  return dedupeIssues(issues)
}

function findOverflowingSectionsOnPage(
  sectionIds: string[],
  sectionHeights: SectionHeightMap,
  budget: number
): string[] {
  let cumulative = 0
  const overflowing: string[] = []

  for (const sectionId of sectionIds) {
    cumulative += sectionHeights[sectionId] ?? 0
    if (cumulative > budget) {
      overflowing.push(sectionId)
    }
  }

  return overflowing.length > 0
    ? overflowing
    : sectionIds.length > 0
      ? [sectionIds[sectionIds.length - 1]]
      : []
}

function getSectionsBeyondBudget(
  sectionIds: string[],
  sectionHeights: SectionHeightMap,
  budget: number
): string[] {
  let cumulative = 0
  const beyond: string[] = []
  let passedBudget = false

  for (const sectionId of sectionIds) {
    cumulative += sectionHeights[sectionId] ?? 0
    if (cumulative > budget) {
      passedBudget = true
    }
    if (passedBudget) {
      beyond.push(sectionId)
    }
  }

  return beyond
}

function dedupeIssues(issues: LayoutIssue[]): LayoutIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.type}:${issue.sectionId ?? ''}:${issue.pageIndex ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasLayoutOverflow(issues: LayoutIssue[]): boolean {
  return issues.length > 0
}

export function getOverflowSectionIds(issues: LayoutIssue[]): Set<string> {
  return new Set(
    issues.filter((i) => i.sectionId).map((i) => i.sectionId as string)
  )
}

export function computePageBudgets(
  pageHeightPx: number,
  pagePaddingPx: number,
  headerHeightPx: number,
  datestampHeightPx: number
): PageBudgets {
  const verticalChrome = pagePaddingPx * 2 + LAYOUT_SAFETY_MARGIN_PX

  return {
    page1ContentHeight:
      pageHeightPx - verticalChrome - headerHeightPx - datestampHeightPx,
    page2ContentHeight:
      pageHeightPx - verticalChrome - datestampHeightPx,
  }
}
