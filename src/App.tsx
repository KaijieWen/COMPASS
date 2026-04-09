import { useState, useEffect, useRef } from 'react'
import { FlyerForm } from '@/components/FlyerForm'
import { FlyerPreview } from '@/components/FlyerPreview'
import type { FlyerData } from '@/lib/utils'
import { exportToPdf } from '@/lib/pdfExport'

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
  const flyerRef = useRef<HTMLDivElement>(null)

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
    if (!flyerRef.current) return
    
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
      alert('Failed to generate PDF. Please try again or use Print.')
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
        <FlyerPreview ref={flyerRef} data={data} visible={true} />
        <div className="print:hidden py-6 px-6 flex justify-center gap-4 flex-wrap">
          <button
            onClick={handleBackToForm}
            className="px-6 py-3 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back to Form
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="px-6 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          className="text-red-500 hover:text-red-700 hover:underline"
        >
          Clear draft
        </button>
      </div>
    </div>
  )
}

export default App
