import { useRef, useState } from 'react'
import { FileUp, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui'
import type { FlyerImportResult, ImportProgress } from '@/lib/flyerImport/types'

export interface ImportNotice {
  fileName: string
  result: FlyerImportResult
}

interface FlyerImportProps {
  onImport: (result: FlyerImportResult, fileName: string) => void
}

export function FlyerImport({ onImport }: FlyerImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setProgress({ message: 'Starting…' })
    try {
      // Loaded on demand: pdf.js + OCR are large and most visits never import
      const { importFlyerFile } = await import('@/lib/flyerImport')
      const result = await importFlyerFile(file, setProgress)
      if (!result.filledFields.length) {
        setError(
          "We couldn't read any flyer information from that file. Make sure it's a flyer downloaded from this app."
        )
        return
      }
      onImport(result, file.name)
    } catch (err) {
      console.error('Failed to import flyer:', err)
      setError(err instanceof Error ? err.message : 'Failed to read that file.')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <div className="max-w-2xl mx-auto mb-4 rounded-lg border border-blue-200 bg-white/80 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Updating an existing flyer?</p>
          <p className="text-xs text-muted-foreground">
            Upload a flyer you downloaded before and we&apos;ll fill the form with its
            information so you can edit it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
          {busy ? 'Reading…' : 'Upload old flyer'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {progress && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="text-xs text-muted-foreground">{progress.message}</p>
          {progress.fraction !== undefined && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.round(progress.fraction * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const SOURCE_MESSAGES: Record<FlyerImportResult['source'], string> = {
  embedded: 'Every field was restored exactly as it was saved.',
  text: 'Please review each step before generating the new flyer.',
  ocr: 'This flyer was read by scanning its image, which can introduce mistakes. Please review each step carefully — especially medications, allergies, and phone numbers.',
}

export function ImportNoticeBanner({
  notice,
  onDismiss,
}: {
  notice: ImportNotice
  onDismiss: () => void
}) {
  const { result, fileName } = notice
  const tone =
    result.source === 'ocr'
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : 'border-green-300 bg-green-50 text-green-950'

  return (
    <div className={`max-w-2xl mx-auto mb-4 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            Imported {result.filledFields.length} field
            {result.filledFields.length === 1 ? '' : 's'} from{' '}
            <span className="break-all">{fileName}</span>
          </p>
          <p className="mt-1">{SOURCE_MESSAGES[result.source]}</p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 space-y-0.5">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-black/5"
          aria-label="Dismiss import message"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
