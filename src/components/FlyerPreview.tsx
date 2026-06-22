import { forwardRef, useMemo, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFlyerLayout } from '@/hooks/useFlyerLayout'
import type { LayoutIssue } from '@/lib/flyerLayout'
import { lines } from '@/lib/utils'
import type { FlyerData } from '@/lib/utils'
import { buildSummary } from '@/lib/utils'

const POLST_LABELS: Record<string, string> = {
  dnr: 'DNR (Do Not Resuscitate)',
  selective: 'Selective Treatment',
  'no-nutrition': 'Comfort Care Only',
}

interface FlyerPreviewProps {
  data: FlyerData
  visible: boolean
  onChange?: (next: FlyerData) => void
  onLayoutChange?: (result: {
    issues: LayoutIssue[]
    hasOverflow: boolean
  }) => void
}

interface SectionItem {
  id: string
  visible: boolean
  className: string
  render: () => React.ReactNode
}

const DEFAULT_SECTION_ORDER = [
  'lifeContext',
  'diagnoses',
  'personalDetails',
  'values',
  'typicalDay',
  'medical',
  'personalBackground',
  'likes',
  'dislikes',
  'providers',
] as const

function DragHandle() {
  return (
    <span
      className="flyer-drag-handle"
      data-export-hide="true"
      aria-label="Drag to reorder section"
      title="Drag to reorder"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="4" cy="3" r="1.2" />
        <circle cx="4" cy="7" r="1.2" />
        <circle cx="4" cy="11" r="1.2" />
        <circle cx="10" cy="3" r="1.2" />
        <circle cx="10" cy="7" r="1.2" />
        <circle cx="10" cy="11" r="1.2" />
      </svg>
    </span>
  )
}

interface SortableSectionProps {
  id: string
  className: string
  overflow?: boolean
  children: React.ReactNode
}

function SortableSection({ id, className, overflow, children }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flyer-section ${className}`}
      data-section-id={id}
      data-draggable="true"
      data-dragging={isDragging ? 'true' : 'false'}
      data-overflow={overflow ? 'true' : undefined}
      {...attributes}
      {...listeners}
    >
      <DragHandle />
      {children}
    </div>
  )
}

function FlyerHeader({
  data,
}: {
  data: FlyerData
}) {
  return (
    <div className="flyer-header">
      <div className="flyer-header-inner">
        <div className="flyer-header-main">
          <div className="flyer-name-row">
            <h1 className="flyer-name">{data.preferredName || 'Patient Name'}</h1>
            <div className="flyer-dob">DOB: {data.dob || '—'}</div>
          </div>
          <div className="flyer-subheader">
            {data.gender && <span>Gender: {data.gender}</span>}
          </div>
        </div>
        {data.profilePhotoUrl ? (
          <img
            className="flyer-header-photo"
            src={data.profilePhotoUrl}
            alt=""
          />
        ) : null}
      </div>
    </div>
  )
}

export const FlyerPreview = forwardRef<HTMLDivElement, FlyerPreviewProps>(
  function FlyerPreview({ data, visible, onChange, onLayoutChange }, ref) {
    const measureRootRef = useRef<HTMLDivElement>(null)

    const summary = buildSummary(data)
    const allCareValues = data.careValues
    const providers = lines(data.otherProviders).map((row) =>
      row.split('|').map((s) => s.trim())
    )
    const showPolst = data.polstStatus !== 'omit'
    const primaryContacts = lines(data.primaryContact)
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const themeClass =
      data.theme === 'ocean'
        ? 'theme-ocean'
        : data.theme === 'forest'
          ? 'theme-forest'
          : data.theme === 'lavender'
            ? 'theme-lavender'
            : 'theme-current'

    const compactClass = data.compactMode ? 'flyer-compact' : ''
    const lifeContextText = data.aboutMe || summary

    const allSections: SectionItem[] = useMemo(() => {
      const items: SectionItem[] = [
        {
          id: 'lifeContext',
          visible: true,
          className: 'flyer-about',
          render: () => (
            <>
              <h2 className="flyer-section-title">Life Context / Recent Changes</h2>
              <p className="flyer-summary">
                {lifeContextText || 'Fill in the form to generate a summary.'}
              </p>
            </>
          ),
        },
        {
          id: 'diagnoses',
          visible: lines(data.diagnoses).length > 0,
          className: 'flyer-medical',
          render: () => (
            <>
              <h2 className="flyer-section-title">Diagnoses</h2>
              <div className="flyer-medical-content">
                <p>{lines(data.diagnoses).join(', ')}</p>
              </div>
            </>
          ),
        },
        {
          id: 'personalDetails',
          visible:
            !!data.dob ||
            !!data.gender ||
            primaryContacts.length > 0 ||
            !!data.primaryCarePhysician ||
            !!data.address,
          className: 'flyer-contact',
          render: () => (
            <>
              <h2 className="flyer-section-title">Personal Details</h2>
              <div className="flyer-contact-grid">
                {data.dob && (
                  <div className="flyer-field">
                    <strong>DOB:</strong>
                    <span>{data.dob}</span>
                  </div>
                )}
                {data.gender && (
                  <div className="flyer-field">
                    <strong>Gender:</strong>
                    <span>{data.gender}</span>
                  </div>
                )}
                {primaryContacts.length > 0 && (
                  <div className="flyer-field flyer-span-full">
                    <strong>Primary Contact:</strong>
                    <span>
                      {primaryContacts.length === 1
                        ? primaryContacts[0]
                        : primaryContacts.map((c, i) => <div key={i}>{c}</div>)}
                    </span>
                  </div>
                )}
                {data.primaryCarePhysician && (
                  <div className="flyer-field">
                    <strong>PCP:</strong>
                    <span>{data.primaryCarePhysician}</span>
                  </div>
                )}
                {data.address && (
                  <div className="flyer-field">
                    <strong>Address:</strong>
                    <span>{data.address}</span>
                  </div>
                )}
              </div>
            </>
          ),
        },
        {
          id: 'values',
          visible: allCareValues.length > 0,
          className: 'flyer-values',
          render: () => (
            <>
              <h2 className="flyer-section-title">Values and Preferences</h2>
              <ul className="flyer-values-list">
                {allCareValues.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: 'typicalDay',
          visible: !!data.dailyRoutine,
          className: 'flyer-day',
          render: () => (
            <>
              <h2 className="flyer-section-title">Typical Day</h2>
              <div className="flyer-routine-content">
                {lines(data.dailyRoutine).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </>
          ),
        },
        {
          id: 'medical',
          visible:
            lines(data.medications).length > 0 ||
            lines(data.allergiesAndReactions).length > 0 ||
            showPolst,
          className: 'flyer-medical',
          render: () => (
            <>
              <h2 className="flyer-section-title">Additional Medical Information</h2>
              <div className="flyer-medical-content">
                {lines(data.medications).length > 0 && (
                  <div className="flyer-field">
                    <strong>Medications:</strong>
                    <ul className="flyer-inline-list">
                      {lines(data.medications).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {lines(data.allergiesAndReactions).length > 0 && (
                  <div className="flyer-field flyer-adverse">
                    <strong>Allergies / Adverse Reactions:</strong>
                    <span>{lines(data.allergiesAndReactions).join(', ')}</span>
                  </div>
                )}
                {showPolst && (
                  <div className="flyer-field flyer-polst-inline">
                    <strong>POLST:</strong>
                    <span>{POLST_LABELS[data.polstStatus] ?? data.polstStatus}</span>
                  </div>
                )}
              </div>
            </>
          ),
        },
        {
          id: 'personalBackground',
          visible: !!data.personalBackground,
          className: 'flyer-personal',
          render: () => (
            <>
              <h2 className="flyer-section-title">Personal Background</h2>
              <p>{data.personalBackground}</p>
            </>
          ),
        },
        {
          id: 'likes',
          visible: lines(data.likesAndComforts).length > 0,
          className: 'flyer-likes',
          render: () => (
            <>
              <h2 className="flyer-section-title">Likes &amp; What Helps Calm</h2>
              <ul>
                {lines(data.likesAndComforts).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: 'dislikes',
          visible: lines(data.dislikesAndTriggers).length > 0,
          className: 'flyer-dislikes',
          render: () => (
            <>
              <h2 className="flyer-section-title">Dislikes &amp; Triggers to Avoid</h2>
              <ul>
                {lines(data.dislikesAndTriggers).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: 'providers',
          visible: providers.length > 0 && providers.some((r) => r.some(Boolean)),
          className: 'flyer-providers',
          render: () => (
            <>
              <h2 className="flyer-section-title">Other Healthcare Providers</h2>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Specialty</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {providers
                    .filter((r) => r.some(Boolean))
                    .map((row, i) => (
                      <tr key={i}>
                        <td>{row[0] ?? ''}</td>
                        <td>{row[1] ?? ''}</td>
                        <td>{row[2] ?? ''}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ),
        },
      ]
      return items
    }, [
      data,
      allCareValues,
      lifeContextText,
      primaryContacts,
      providers,
      showPolst,
    ])

    const effectiveOrder = useMemo(() => {
      const knownIds = new Set(allSections.map((s) => s.id))
      const fromSaved = (data.sectionOrder ?? []).filter((id) => knownIds.has(id))
      const remaining = DEFAULT_SECTION_ORDER.filter(
        (id) => !fromSaved.includes(id) && knownIds.has(id)
      )
      return [...fromSaved, ...remaining]
    }, [data.sectionOrder, allSections])

    const orderedSections = useMemo(() => {
      const sectionMap = new Map(allSections.map((s) => [s.id, s]))
      return effectiveOrder
        .map((id) => sectionMap.get(id))
        .filter((s): s is SectionItem => !!s && s.visible)
    }, [effectiveOrder, allSections])

    const sectionIds = useMemo(
      () => orderedSections.map((s) => s.id),
      [orderedSections]
    )
    const sectionMap = useMemo(
      () => new Map(orderedSections.map((s) => [s.id, s])),
      [orderedSections]
    )

    const { pageGroups, overflowingSectionIds } = useFlyerLayout({
      orderedSectionIds: sectionIds,
      compactMode: data.compactMode,
      measureRootRef,
      onLayoutChange,
    })

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    )

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      if (!onChange) return

      const oldIndex = sectionIds.indexOf(String(active.id))
      const newIndex = sectionIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return

      const newVisibleOrder = arrayMove(sectionIds, oldIndex, newIndex)

      const currentFullOrder = effectiveOrder
      const hiddenIds = currentFullOrder.filter((id) => !sectionIds.includes(id))
      const merged: string[] = []
      let visibleCursor = 0
      for (const id of currentFullOrder) {
        if (hiddenIds.includes(id)) {
          merged.push(id)
        } else {
          merged.push(newVisibleOrder[visibleCursor++])
        }
      }

      onChange({ ...data, sectionOrder: merged })
    }

    const displayPageGroups =
      pageGroups.length > 0 ? pageGroups.slice(0, 2) : [sectionIds]

    if (!visible) return null

    return (
      <>
        {/* Hidden measurement container — export-equivalent geometry */}
        <div
          ref={measureRootRef}
          className="flyer-measure-root flyer-layout-measure"
          aria-hidden="true"
        >
          <div className={`flyer-output ${themeClass} ${compactClass}`}>
            <div className="flyer-page">
              <FlyerHeader data={data} />
              {orderedSections.map((section) => (
                <div
                  key={section.id}
                  className={`flyer-section ${section.className}`}
                  data-section-id={section.id}
                >
                  {section.render()}
                </div>
              ))}
              <div className="flyer-datestamp">Generated: {generatedDate}</div>
            </div>
          </div>
        </div>

        <div
          ref={ref}
          id="flyer-output"
          className={`flyer-output ${themeClass} ${compactClass}`}
          data-theme={data.theme}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              {displayPageGroups.map((sectionIdsOnPage, pageIndex) => (
                <div
                  key={pageIndex}
                  className={`flyer-page ${pageIndex > 0 ? 'flyer-break' : ''}`}
                >
                  {pageIndex === 0 && <FlyerHeader data={data} />}

                  {sectionIdsOnPage.map((id) => {
                    const section = sectionMap.get(id)
                    if (!section) return null
                    return (
                      <SortableSection
                        key={section.id}
                        id={section.id}
                        className={section.className}
                        overflow={overflowingSectionIds.has(section.id)}
                      >
                        {section.render()}
                      </SortableSection>
                    )
                  })}

                  <div className="flyer-datestamp">Generated: {generatedDate}</div>
                  <div className="flyer-page-boundary" aria-hidden="true" />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </>
    )
  }
)
