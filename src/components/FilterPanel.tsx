import { type Genre, type TimePeriod, TIME_PERIODS, LANGUAGES } from '../lib/tmdb'

interface FilterPanelProps {
  genres: Genre[]
  selectedGenreId: number | null
  selectedLanguage: string | null
  selectedPeriod: TimePeriod | null
  minStars: number
  onGenreChange: (id: number | null) => void
  onLanguageChange: (code: string | null) => void
  onPeriodChange: (period: TimePeriod | null) => void
  onMinStarsChange: (stars: number) => void
  disabled: boolean
}

export default function FilterPanel({
  genres,
  selectedGenreId,
  selectedLanguage,
  selectedPeriod,
  minStars,
  onGenreChange,
  onLanguageChange,
  onPeriodChange,
  onMinStarsChange,
  disabled,
}: FilterPanelProps) {
  return (
    <div className="filter-panel">
      <FilterSelect
        label="Genre"
        disabled={disabled}
        value={selectedGenreId !== null ? String(selectedGenreId) : ''}
        onChange={(v) => onGenreChange(v ? Number(v) : null)}
      >
        <option value="">Any Genre</option>
        {genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Language"
        disabled={disabled}
        value={selectedLanguage ?? ''}
        onChange={(v) => onLanguageChange(v || null)}
      >
        <option value="">Any Language</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Era"
        disabled={disabled}
        value={selectedPeriod ? String(selectedPeriod.from) : ''}
        onChange={(v) => {
          const match = TIME_PERIODS.find((p) => String(p.from) === v)
          onPeriodChange(match ?? null)
        }}
      >
        <option value="">Any Era</option>
        {TIME_PERIODS.map((p) => (
          <option key={p.from} value={p.from}>
            {p.label}
          </option>
        ))}
      </FilterSelect>

      {/* Min-stars filter */}
      <div className="stars-selector">
        <label className="filter-label">Min. Rating</label>
        <div className="stars-row">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={['star-btn', star <= minStars ? 'active' : ''].join(' ')}
              onClick={() => onMinStarsChange(star === minStars ? 0 : star)}
              disabled={disabled}
              title={`${star} star${star > 1 ? 's' : ''} minimum`}
            >
              ★
            </button>
          ))}
          {minStars > 0 && (
            <button
              className="stars-clear"
              onClick={() => onMinStarsChange(0)}
              disabled={disabled}
              title="Clear rating filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  children: React.ReactNode
}

function FilterSelect({ label, value, onChange, disabled, children }: FilterSelectProps) {
  return (
    <div className="filter-select-wrapper">
      <label className="filter-label">{label}</label>
      <select
        className="filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  )
}
