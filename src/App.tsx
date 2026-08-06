import { useState, useEffect, useRef, useCallback } from 'react'
import { FlyerForm } from '@/components/FlyerForm'
import { FlyerPreview } from '@/components/FlyerPreview'
import type { FlyerData } from '@/lib/utils'
import { exportToPdf, FlyerLayoutError } from '@/lib/pdfExport'
import type { LayoutIssue } from '@/lib/flyerLayout'

const INITIAL_DATA: FlyerData = {
  theme: 'current',
  profilePhotoUrl: '',
  preferredName: '',
  dob: '',
  gender: '',
  aboutMe: '',
  diagnoses: '',
  allergiesAndReactions: '',
  medications: '',
  polstStatus: 'omit',
  primaryContact: '',
  primaryCarePhysician: '',
  otherProviders: '',
  address: '',
  careValues: [],
  dailyRoutine: '',
  likesAndComforts: '',
  dislikesAndTriggers: '',
  personalBackground: '',
  compactMode: false,
  sectionOrder: [],
}

const STORAGE_KEY = 'patient-flyer-draft'

function loadSavedData(): FlyerData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...INITIAL_DATA, ...parsed }
    }
  } catch {
    // Ignore parse errors
  }
  return INITIAL_DATA
}

function saveData(data: FlyerData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

const TOTAL_STEPS = 5

function App() {
  const [data, setData] = useState<FlyerData>(loadSavedData)
  const [step, setStep] = useState(0)
  const [showFlyer, setShowFlyer] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [layoutIssues, setLayoutIssues] = useState<LayoutIssue[]>([])
  const [hasOverflow, setHasOverflow] = useState(false)
  const flyerRef = useRef<HTMLDivElement>(null)

  const handleLayoutChange = useCallback(
    (result: { issues: LayoutIssue[]; hasOverflow: boolean }) => {
      setLayoutIssues(result.issues)
      setHasOverflow(result.hasOverflow)
    },
    []
  )

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    saveData(data)
    setLastSaved(new Date())
  }, [data])

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleGenerate = () => {
    setShowFlyer(true)
  }

  const handleBackToForm = () => {
    setShowFlyer(false)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!flyerRef.current || hasOverflow) return

    setIsExporting(true)
    try {
      const patientName = data.preferredName.trim() || 'patient'
      const safeName = patientName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      await exportToPdf(flyerRef.current, {
        filename: `flyer-${safeName}.pdf`,
        quality: 2,
      })
    } catch (error) {
      console.error('Failed to export PDF:', error)
      if (error instanceof FlyerLayoutError) {
        setLayoutIssues(error.issues)
        setHasOverflow(true)
        alert(
          'Cannot download PDF — some content will be cut off. Fix the highlighted sections in the preview, then try again.'
        )
      } else {
        alert('Failed to generate PDF. Please try again or use Print.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearDraft = () => {
    if (confirm('Clear all form data and start fresh?')) {
      localStorage.removeItem(STORAGE_KEY)
      setData(INITIAL_DATA)
      setStep(0)
    }
  }

  if (showFlyer) {
    return (
      <div className="min-h-screen bg-[radial-gradient(1200px_700px_at_12%_-10%,rgba(56,189,248,0.35),transparent_62%),radial-gradient(1000px_620px_at_88%_2%,rgba(251,146,60,0.30),transparent_60%),linear-gradient(180deg,#dbeafe_0%,#e2e8f0_45%,#cbd5e1_100%)] print:bg-white print:p-0">
        <FlyerPreview
          ref={flyerRef}
          data={data}
          visible={true}
          onChange={setData}
          onLayoutChange={handleLayoutChange}
        />
        {hasOverflow && (
          <div className="print:hidden max-w-3xl mx-auto px-6 -mt-2 mb-2">
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              <p className="font-semibold mb-2">
                Some content will be cut off in the PDF.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {layoutIssues.map((issue, i) => (
                  <li key={`${issue.type}-${issue.sectionId ?? ''}-${i}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-red-800">
                Drag sections using the grip handle on the left to rebalance pages, or{' '}
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="underline font-medium hover:text-red-950"
                >
                  go back to the form
                </button>{' '}
                to shorten text.
              </p>
            </div>
          </div>
        )}
        <div className="print:hidden py-6 px-6 flex flex-col items-center gap-3">
          {hasOverflow && (
            <p className="text-sm text-red-600 font-medium">
              Fix layout issues before downloading.
            </p>
          )}
          <div className="flex justify-center gap-4 flex-wrap">
          <button
            onClick={handleBackToForm}
            className="px-6 py-3 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Form
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting || hasOverflow}
            className="px-6 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title={hasOverflow ? 'Fix layout issues before downloading.' : undefined}
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Generating PDF...
              </>
            ) : (
              <>
                📥 Download PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-3 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            🖨️ Print
          </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-6 px-4 bg-[radial-gradient(1200px_700px_at_12%_-10%,rgba(56,189,248,0.35),transparent_62%),radial-gradient(1000px_620px_at_88%_2%,rgba(251,146,60,0.30),transparent_60%),linear-gradient(180deg,#dbeafe_0%,#e2e8f0_45%,#cbd5e1_100%)]">
      <FlyerForm
        data={data}
        onChange={setData}
        step={step}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleGenerate}
      />
      {/* Auto-save indicator and clear draft button */}
      <div className="max-w-2xl mx-auto mt-4 flex justify-between items-center text-xs text-muted-foreground px-2">
        <span>
          {lastSaved && `Draft auto-saved at ${lastSaved.toLocaleTimeString()}`}
        </span>
        <button
          onClick={handleClearDraft}
          className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-md bg-red-50 hover:bg-red-100 hover:border-red-400 hover:text-red-700 transition-colors"
        >
          🗑️ Clear Draft
        </button>
      </div>
    </div>
  )
}

export default App
