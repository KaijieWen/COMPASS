import { forwardRef, useMemo } from 'react'
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
  children: React.ReactNode
}

function SortableSection({ id, className, children }: SortableSectionProps) {
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
      data-draggable="true"
      data-dragging={isDragging ? 'true' : 'false'}
      {...attributes}
      {...listeners}
    >
      <DragHandle />
      {children}
    </div>
  )
}

export const FlyerPreview = forwardRef<HTMLDivElement, FlyerPreviewProps>(
  function FlyerPreview({ data, visible, onChange }, ref) {
    if (!visible) return null

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

    // Build all possible section items with stable ids
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

    // Compute effective order: saved order first, then any defaults not in saved order
    const effectiveOrder = useMemo(() => {
      const knownIds = new Set(allSections.map((s) => s.id))
      const fromSaved = (data.sectionOrder ?? []).filter((id) => knownIds.has(id))
      const remaining = DEFAULT_SECTION_ORDER.filter(
        (id) => !fromSaved.includes(id) && knownIds.has(id)
      )
      return [...fromSaved, ...remaining]
    }, [data.sectionOrder, allSections])

    // Build the final ordered list of visible sections
    const orderedSections = useMemo(() => {
      const sectionMap = new Map(allSections.map((s) => [s.id, s]))
      return effectiveOrder
        .map((id) => sectionMap.get(id))
        .filter((s): s is SectionItem => !!s && s.visible)
    }, [effectiveOrder, allSections])

    const sectionIds = orderedSections.map((s) => s.id)
    const pageOneCount = 6
    const pageOneSections =
      data.compactMode || orderedSections.length <= pageOneCount
        ? orderedSections
        : orderedSections.slice(0, pageOneCount)
    const pageTwoSections =
      data.compactMode || orderedSections.length <= pageOneCount
        ? []
        : orderedSections.slice(pageOneCount)

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

      // Build the new full order, applying the move within the visible subset,
      // while preserving the relative position of any hidden ids in the saved order.
      const newVisibleOrder = arrayMove(sectionIds, oldIndex, newIndex)

      // Reconstitute by interleaving hidden saved ids at their original positions
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

    return (
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
            <div className="flyer-page">
              {/* Locked header */}
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

              {pageOneSections.map((section) => (
                <SortableSection
                  key={section.id}
                  id={section.id}
                  className={section.className}
                >
                  {section.render()}
                </SortableSection>
              ))}

              {/* Locked date stamp */}
              <div className="flyer-datestamp">Generated: {generatedDate}</div>
            </div>

            {!data.compactMode && pageTwoSections.length > 0 && (
              <div className="flyer-page flyer-break">
                {pageTwoSections.map((section) => (
                  <SortableSection
                    key={section.id}
                    id={section.id}
                    className={section.className}
                  >
                    {section.render()}
                  </SortableSection>
                ))}
                <div className="flyer-datestamp">Generated: {generatedDate}</div>
              </div>
            )}
          </SortableContext>
        </DndContext>
      </div>
    )
  }
)
