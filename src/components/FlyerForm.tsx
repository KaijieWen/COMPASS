import { useRef } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui'
import { ThemePreviewBar } from '@/components/ThemePreviewBar'
import { CARE_VALUES, type FlyerData } from '@/lib/utils'
import { FLYER_THEMES, getFlyerTheme } from '@/lib/themes'

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024

const STEP_TITLES = [
  'Patient Identity',
  'Medical & Safety',
  'Contacts & Care Team',
  'Preferences & Daily Care',
  'Review & Generate',
]

const EXAMPLE_DATA: Partial<FlyerData> = {
  profilePhotoUrl: '',
  preferredName: 'Bob',
  dob: '03/15/1935',
  gender: 'Male',
  aboutMe: 'Recently moved to assisted living after a fall at home. Has been adjusting well but sometimes feels anxious in the evenings. Enjoys visits from family, especially grandchildren.',
  diagnoses: 'Alzheimer\'s disease (early stage)\nType 2 Diabetes\nHypertension\nOsteoarthritis',
  allergiesAndReactions: 'Penicillin – causes hives\nCodeine – nausea and confusion',
  medications: 'Donepezil 10mg daily (morning)\nMetformin 500mg twice daily\nLisinopril 10mg daily\nAcetaminophen 500mg as needed for pain',
  polstStatus: 'selective',
  primaryContact: 'Mary Johnson (Daughter, DPOA) – (858) 555-0199\nJohn Smith (Son) – (858) 555-0188',
  primaryCarePhysician: 'Dr. Jane Chen – (858) 555-0100',
  otherProviders: 'Dr. Michael Park | Cardiology | (858) 555-0200\nDr. Sarah Wilson | Neurology | (858) 555-0300',
  address: '123 Sunset Drive, San Diego, CA 92101',
  careValues: ['Dignity', 'Comfort', 'Family involvement', 'Quality of life'],
  dailyRoutine: 'Morning: Wakes around 7am, needs assistance with bathing and dressing. Prefers to shave himself with supervision.\nMidday: Enjoys short walks in the garden. Naps after lunch (1-2pm). Likes doing puzzles.\nEvening: Dinner at 5:30pm. Watches news at 6pm. Prefers to be in bed by 9pm.',
  likesAndComforts: 'Soft classical music (especially Mozart)\nWarm blankets\nLooking at family photo albums\nGentle hand massage helps reduce anxiety\nHis favorite recliner chair',
  dislikesAndTriggers: 'Loud or sudden noises\nBeing rushed or feeling hurried\nCold rooms\nStrong perfumes or cleaning chemicals\nCrowded spaces',
  personalBackground: 'Retired plumber of 45 years, very proud of his work. Born and raised in Chicago, moved to San Diego in 1980. Loves fishing and used to take his grandchildren every summer. Catholic faith is important to him. Enjoys classic rock music, especially The Beatles.',
}

interface FlyerFormProps {
  data: FlyerData
  onChange: (data: FlyerData) => void
  step: number
  onNext: () => void
  onBack: () => void
  onSubmit: () => void
  onLoadExample?: () => void
}

export function FlyerForm({
  data,
  onChange,
  step,
  onNext,
  onBack,
  onSubmit,
  onLoadExample,
}: FlyerFormProps) {
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof FlyerData>(k: K, v: FlyerData[K]) => {
    onChange({ ...data, [k]: v })
  }

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      alert('Image must be 2 MB or smaller.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update('profilePhotoUrl', reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleClearProfilePhoto = () => {
    update('profilePhotoUrl', '')
    if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = ''
  }

  const toggleCareValue = (val: string) => {
    const next = data.careValues.includes(val)
      ? data.careValues.filter((x) => x !== val)
      : [...data.careValues, val]
    update('careValues', next)
  }

  const handleLoadExample = () => {
    onChange({ ...data, ...EXAMPLE_DATA } as FlyerData)
    onLoadExample?.()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 print:hidden">
      <h2 className="text-xl font-semibold text-center">Create Patient Flyer</h2>
      
      {/* Progress Bar */}
      <div className="px-2">
        <div className="flex items-center justify-between mb-2">
          {STEP_TITLES.map((title, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs mt-1 text-center hidden md:block text-muted-foreground">
                {title.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / (STEP_TITLES.length - 1)) * 100}%` }}
          />
        </div>
        <div className="text-center text-sm text-muted-foreground mt-2">
          Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Patient Identity */}
          {step === 0 && (
            <div className="space-y-3">
              {/* Quick-fill button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Load example data
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="preferredName">Preferred Name</Label>
                  <Input
                    id="preferredName"
                    value={data.preferredName}
                    onChange={(e) => update('preferredName', e.target.value)}
                    placeholder="e.g., Bob, Bobby, Robert"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    id="dob"
                    value={data.dob}
                    onChange={(e) => update('dob', e.target.value)}
                    placeholder="MM/DD/YYYY"
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
                <Label htmlFor="profilePhoto" className="text-muted-foreground">
                  Profile photo (optional)
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="profilePhoto"
                    ref={profilePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="max-w-xs cursor-pointer"
                    onChange={handleProfilePhotoChange}
                  />
                  {data.profilePhotoUrl ? (
                    <>
                      <img
                        src={data.profilePhotoUrl}
                        alt=""
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearProfilePhoto}
                      >
                        Remove photo
                      </Button>
                    </>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, or other image. Max 2 MB.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={data.gender || '_'}
                  onValueChange={(v) => update('gender', v === '_' ? '' : v)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="— Select —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">— Select —</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aboutMe">About Me</Label>
                <Textarea
                  id="aboutMe"
                  value={data.aboutMe}
                  onChange={(e) => update('aboutMe', e.target.value)}
                  rows={3}
                  placeholder="Brief background and current situation. e.g., Recently moved to assisted living after a fall. Has been feeling anxious about the transition. Enjoys visits from family."
                />
              </div>
            </div>
          )}

          {/* Step 2: Medical & Safety */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="diagnoses">Diagnoses / Conditions</Label>
                <Textarea
                  id="diagnoses"
                  value={data.diagnoses}
                  onChange={(e) => update('diagnoses', e.target.value)}
                  rows={3}
                  placeholder={'e.g., Alzheimer\'s disease\nType 2 Diabetes\nHypertension'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="allergiesAndReactions" className="text-red-600">
                  Allergies & Adverse Reactions
                </Label>
                <Textarea
                  id="allergiesAndReactions"
                  value={data.allergiesAndReactions}
                  onChange={(e) => update('allergiesAndReactions', e.target.value)}
                  rows={2}
                  placeholder={'e.g., Penicillin – hives\nCodeine – nausea'}
                  className="border-red-200 focus:border-red-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medications">Current Medications</Label>
                <Textarea
                  id="medications"
                  value={data.medications}
                  onChange={(e) => update('medications', e.target.value)}
                  rows={4}
                  placeholder={'e.g., Donepezil 10mg daily\nMetformin 500mg twice daily\nLisinopril 10mg daily'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>POLST Status</Label>
                <RadioGroup
                  value={data.polstStatus}
                  onValueChange={(v) => update('polstStatus', v as FlyerData['polstStatus'])}
                  className="space-y-2"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="dnr" />
                    <span className="text-sm">DNR (Do Not Resuscitate)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="selective" />
                    <span className="text-sm">Selective Treatment</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="no-nutrition" />
                    <span className="text-sm">Comfort Care Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="omit" />
                    <span className="text-sm">Do not include on flyer</span>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 3: Contacts & Care Team */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="primaryContact">Primary Contact (Emergency / DPOA)</Label>
                <Textarea
                  id="primaryContact"
                  value={data.primaryContact}
                  onChange={(e) => update('primaryContact', e.target.value)}
                  rows={2}
                  placeholder={'e.g., Mary Smith (Daughter, DPOA) – (858) 555-0199\nJohn Smith (Son) – (858) 555-0188'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="primaryCarePhysician">Primary Care Physician</Label>
                <Input
                  id="primaryCarePhysician"
                  value={data.primaryCarePhysician}
                  onChange={(e) => update('primaryCarePhysician', e.target.value)}
                  placeholder="e.g., Dr. Jane Smith – (858) 555-0100"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="otherProviders">Other Healthcare Providers</Label>
                <Textarea
                  id="otherProviders"
                  value={data.otherProviders}
                  onChange={(e) => update('otherProviders', e.target.value)}
                  rows={3}
                  placeholder={'e.g., Dr. Chen | Cardiology | (858) 555-0200\nDr. Johnson | Neurology | (858) 555-0300'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  value={data.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="e.g., 123 Main St, San Diego, CA 92101"
                />
              </div>
            </div>
          )}

          {/* Step 4: Preferences & Daily Care */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Care Values</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CARE_VALUES.map((v) => (
                    <label
                      key={v}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={data.careValues.includes(v)}
                        onCheckedChange={() => toggleCareValue(v)}
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dailyRoutine">Daily Routine & Care Needs</Label>
                <Textarea
                  id="dailyRoutine"
                  value={data.dailyRoutine}
                  onChange={(e) => update('dailyRoutine', e.target.value)}
                  rows={4}
                  placeholder={'e.g., Morning: Wakes 7am, needs help with bathing/dressing\nMidday: Enjoys walking, naps after lunch\nEvening: Dinner at 5:30pm, in bed by 9pm'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="likesAndComforts">Likes & What Helps Calm</Label>
                <Textarea
                  id="likesAndComforts"
                  value={data.likesAndComforts}
                  onChange={(e) => update('likesAndComforts', e.target.value)}
                  rows={3}
                  placeholder={'e.g., Soft music, warm blankets, family photos\nGentle hand massage helps reduce anxiety'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dislikesAndTriggers">Dislikes & Triggers to Avoid</Label>
                <Textarea
                  id="dislikesAndTriggers"
                  value={data.dislikesAndTriggers}
                  onChange={(e) => update('dislikesAndTriggers', e.target.value)}
                  rows={3}
                  placeholder={'e.g., Loud noises, being rushed\nCold rooms, strong perfumes'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="personalBackground">Personal Background</Label>
                <Textarea
                  id="personalBackground"
                  value={data.personalBackground}
                  onChange={(e) => update('personalBackground', e.target.value)}
                  rows={3}
                  placeholder={'e.g., Retired teacher, born in Chicago. Enjoys gardening, classical music, and spending time with grandchildren. Catholic faith is important.'}
                />
              </div>
            </div>
          )}

          {/* Step 5: Review & Generate */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review complete. Select your preferences and generate your flyer.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="theme">Color Theme</Label>
                <Select
                  value={data.theme}
                  onValueChange={(v) => update('theme', v as FlyerData['theme'])}
                >
                  <SelectTrigger id="theme">
                    <div className="flex items-center gap-2">
                      <ThemePreviewBar colors={getFlyerTheme(data.theme).preview} />
                      <span>{getFlyerTheme(data.theme).label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {FLYER_THEMES.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id} textValue={theme.label}>
                        <div className="flex items-center gap-2">
                          <ThemePreviewBar colors={theme.preview} />
                          <span>{theme.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={data.compactMode}
                    onCheckedChange={(checked) => update('compactMode', !!checked)}
                  />
                  <span className="text-sm">
                    Compact mode (fit on single page with smaller text)
                  </span>
                </label>
                <p className="text-xs text-muted-foreground ml-6">
                  Fits on one page with smaller text. Very long entries may still overflow — you&apos;ll see a warning on the flyer preview.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 0 ? (
              <Button variant="outline" onClick={onBack}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < 4 ? (
              <Button onClick={onNext}>Proceed</Button>
            ) : (
              <Button onClick={onSubmit}>Generate Flyer</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
