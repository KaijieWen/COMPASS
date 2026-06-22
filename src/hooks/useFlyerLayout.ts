import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  analyzeLayout,
  computePageBudgets,
  getOverflowSectionIds,
  hasLayoutOverflow,
  paginateSections,
  PAGE_HEIGHT_PX,
  type LayoutIssue,
  type SectionHeightMap,
} from '@/lib/flyerLayout'

export interface FlyerLayoutResult {
  pageGroups: string[][]
  issues: LayoutIssue[]
  hasOverflow: boolean
  overflowingSectionIds: Set<string>
  isLayoutReady: boolean
}

interface UseFlyerLayoutOptions {
  orderedSectionIds: string[]
  compactMode: boolean
  measureRootRef: React.RefObject<HTMLElement | null>
  onLayoutChange?: (result: {
    issues: LayoutIssue[]
    hasOverflow: boolean
  }) => void
}

function readSectionHeights(root: HTMLElement): SectionHeightMap {
  const heights: SectionHeightMap = {}
  root.querySelectorAll<HTMLElement>('[data-section-id]').forEach((el) => {
    const id = el.dataset.sectionId
    if (id) {
      const style = getComputedStyle(el)
      const marginBottom = parseFloat(style.marginBottom) || 0
      heights[id] = el.getBoundingClientRect().height + marginBottom
    }
  })
  return heights
}

function readChromeHeights(root: HTMLElement): {
  headerHeight: number
  datestampHeight: number
  pagePadding: number
} {
  const header = root.querySelector<HTMLElement>('.flyer-header')
  const datestamp = root.querySelector<HTMLElement>('.flyer-datestamp')
  const page = root.querySelector<HTMLElement>('.flyer-page')

  const pageStyle = page ? getComputedStyle(page) : null
  const paddingTop = pageStyle ? parseFloat(pageStyle.paddingTop) : 0

  return {
    headerHeight: header?.getBoundingClientRect().height ?? 0,
    datestampHeight: datestamp?.getBoundingClientRect().height ?? 0,
    pagePadding: paddingTop,
  }
}

function issuesEqual(a: LayoutIssue[], b: LayoutIssue[]): boolean {
  if (a.length !== b.length) return false
  return a.every((issue, i) => {
    const other = b[i]
    return (
      issue.type === other.type &&
      issue.sectionId === other.sectionId &&
      issue.pageIndex === other.pageIndex &&
      issue.message === other.message
    )
  })
}

function pageGroupsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false
  return a.every((page, i) => {
    const other = b[i]
    if (page.length !== other.length) return false
    return page.every((id, j) => id === other[j])
  })
}

export function useFlyerLayout({
  orderedSectionIds,
  compactMode,
  measureRootRef,
  onLayoutChange,
}: UseFlyerLayoutOptions): FlyerLayoutResult {
  const [pageGroups, setPageGroups] = useState<string[][]>([orderedSectionIds])
  const [issues, setIssues] = useState<LayoutIssue[]>([])
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const onLayoutChangeRef = useRef(onLayoutChange)
  const lastNotifiedRef = useRef<{ hasOverflow: boolean; issuesKey: string } | null>(
    null
  )
  onLayoutChangeRef.current = onLayoutChange

  const remeasure = useCallback(() => {
    const root = measureRootRef.current
    if (!root || orderedSectionIds.length === 0) {
      const emptyGroups: string[][] = [[]]
      setPageGroups((prev) =>
        pageGroupsEqual(prev, emptyGroups) ? prev : emptyGroups
      )
      setIssues((prev) => (prev.length === 0 ? prev : []))
      setIsLayoutReady(true)
      const notifyKey = ''
      if (
        lastNotifiedRef.current?.issuesKey !== notifyKey ||
        lastNotifiedRef.current?.hasOverflow !== false
      ) {
        lastNotifiedRef.current = { hasOverflow: false, issuesKey: notifyKey }
        onLayoutChangeRef.current?.({ issues: [], hasOverflow: false })
      }
      return
    }

    const sectionHeights = readSectionHeights(root)
    const { headerHeight, datestampHeight, pagePadding } = readChromeHeights(root)

    const budgets = computePageBudgets(
      PAGE_HEIGHT_PX,
      pagePadding,
      headerHeight,
      datestampHeight
    )

    const groups = paginateSections(
      orderedSectionIds,
      sectionHeights,
      budgets,
      compactMode
    )

    const layoutIssues = analyzeLayout(
      groups,
      sectionHeights,
      budgets,
      compactMode
    )

    const overflow = hasLayoutOverflow(layoutIssues)

    setPageGroups((prev) => (pageGroupsEqual(prev, groups) ? prev : groups))
    setIssues((prev) =>
      issuesEqual(prev, layoutIssues) ? prev : layoutIssues
    )
    setIsLayoutReady(true)

    const issuesKey = layoutIssues
      .map((i) => `${i.type}:${i.sectionId ?? ''}:${i.pageIndex ?? ''}`)
      .join('|')
    if (
      lastNotifiedRef.current?.issuesKey !== issuesKey ||
      lastNotifiedRef.current?.hasOverflow !== overflow
    ) {
      lastNotifiedRef.current = { hasOverflow: overflow, issuesKey }
      onLayoutChangeRef.current?.({ issues: layoutIssues, hasOverflow: overflow })
    }
  }, [orderedSectionIds, compactMode, measureRootRef])

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure])

  useEffect(() => {
    const root = measureRootRef.current
    if (!root) return

    const observer = new ResizeObserver(() => {
      remeasure()
    })

    observer.observe(root)
    root.querySelectorAll('[data-section-id]').forEach((el) => {
      observer.observe(el)
    })

    const handleResize = () => remeasure()
    window.addEventListener('resize', handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [measureRootRef, orderedSectionIds, remeasure])

  return {
    pageGroups,
    issues,
    hasOverflow: hasLayoutOverflow(issues),
    overflowingSectionIds: getOverflowSectionIds(issues),
    isLayoutReady,
  }
}
