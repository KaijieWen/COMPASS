import { forwardRef } from 'react'
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
}

export const FlyerPreview = forwardRef<HTMLDivElement, FlyerPreviewProps>(
  function FlyerPreview({ data, visible }, ref) {
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

  return (
    <div 
      ref={ref}
      id="flyer-output"
      className={`flyer-output ${themeClass} ${compactClass}`} 
      data-theme={data.theme}
    >
      {/* Page 1 - Priority section order */}
      <div className="flyer-page">
        {/* Header: Name + DOB */}
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

        {/* 1) Life context / recent changes */}
        <div className="flyer-section flyer-about">
          <h2 className="flyer-section-title">Life Context / Recent Changes</h2>
          <p className="flyer-summary">
            {lifeContextText || 'Fill in the form to generate a summary.'}
          </p>
        </div>

        {/* 2) Diagnoses */}
        {lines(data.diagnoses).length > 0 && (
          <div className="flyer-section flyer-medical">
            <h2 className="flyer-section-title">Diagnoses</h2>
            <div className="flyer-medical-content">
              <p>{lines(data.diagnoses).join(', ')}</p>
            </div>
          </div>
        )}

        {/* 3) Personal Details */}
        <div className="flyer-section flyer-contact">
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
        </div>

        {/* 4) Values and preferences */}
        {allCareValues.length > 0 && (
          <div className="flyer-section flyer-values">
            <h2 className="flyer-section-title">Values and Preferences</h2>
            <ul className="flyer-values-list">
              {allCareValues.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 5) Typical day */}
        {data.dailyRoutine && (
          <div className="flyer-section flyer-day">
            <h2 className="flyer-section-title">Typical Day</h2>
            <div className="flyer-routine-content">
              {lines(data.dailyRoutine).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Remaining sections */}
        <div className="flyer-section flyer-medical">
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
        </div>

        {/* Compact mode: Include page 2 content on page 1 */}
        {data.compactMode && (
          <>
            {data.personalBackground && (
              <div className="flyer-section flyer-personal">
                <h2 className="flyer-section-title">Personal Background</h2>
                <p>{data.personalBackground}</p>
              </div>
            )}

            {lines(data.likesAndComforts).length > 0 && (
              <div className="flyer-section flyer-likes">
                <h2 className="flyer-section-title">Likes & Comforts</h2>
                <ul>
                  {lines(data.likesAndComforts).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}

            {lines(data.dislikesAndTriggers).length > 0 && (
              <div className="flyer-section flyer-dislikes">
                <h2 className="flyer-section-title">Dislikes & Triggers</h2>
                <ul>
                  {lines(data.dislikesAndTriggers).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Date stamp */}
        <div className="flyer-datestamp">
          Generated: {generatedDate}
        </div>
      </div>

      {/* Page 2 - Daily Life and Support (only in non-compact mode) */}
      {!data.compactMode && (
        <div className="flyer-page flyer-break">
          {/* Personal Background */}
          {data.personalBackground && (
            <div className="flyer-section flyer-personal">
              <h2 className="flyer-section-title">Personal Background</h2>
              <p>{data.personalBackground}</p>
            </div>
          )}

          {/* Likes & Comforts */}
          {lines(data.likesAndComforts).length > 0 && (
            <div className="flyer-section flyer-likes">
              <h2 className="flyer-section-title">Likes & What Helps Calm</h2>
              <ul>
                {lines(data.likesAndComforts).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dislikes & Triggers */}
          {lines(data.dislikesAndTriggers).length > 0 && (
            <div className="flyer-section flyer-dislikes">
              <h2 className="flyer-section-title">Dislikes & Triggers to Avoid</h2>
              <ul>
                {lines(data.dislikesAndTriggers).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Other Providers */}
          {providers.length > 0 && providers.some((r) => r.some(Boolean)) && (
            <div className="flyer-section flyer-providers">
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
            </div>
          )}

          {/* Date stamp for page 2 */}
          <div className="flyer-datestamp">
            Generated: {generatedDate}
          </div>
        </div>
      )}
    </div>
  )
})
