import { useEffect, useRef, useState } from 'react'
import EightBall, { type BallPhase } from './components/EightBall'
import FilterPanel from './components/FilterPanel'
import MovieReveal from './components/MovieReveal'
import {
  fetchGenres,
  fetchRandomMovie,
  type Genre,
  type Movie,
  type TimePeriod,
} from './lib/tmdb'

type AppPhase = 'idle' | 'loading' | 'revealed' | 'error' | 'empty'

const ANIMATION_MS = 3200 // shake (1600ms) + flip (1100ms) + buffer

export default function App() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null)

  const [appPhase, setAppPhase] = useState<AppPhase>('idle')
  const [ballPhase, setBallPhase] = useState<BallPhase>('idle')
  const [movie, setMovie] = useState<Movie | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {
      // silently fail — genres list degrades to empty
    })
  }, [])

  async function consultOracle() {
    if (appPhase === 'loading') return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setMovie(null)
    setErrorMsg('')
    setAppPhase('loading')
    setBallPhase('shaking')

    // After shake finishes, flip the ball
    const flipTimer = setTimeout(() => setBallPhase('flipping'), 1600)

    try {
      const [result] = await Promise.all([
        fetchRandomMovie(selectedGenreId, selectedLanguage, selectedPeriod),
        new Promise((r) => setTimeout(r, ANIMATION_MS)),
      ])

      clearTimeout(flipTimer)

      if (!result) {
        setBallPhase('idle')
        setAppPhase('empty')
        return
      }

      setMovie(result)
      setBallPhase('revealed')
      setAppPhase('revealed')
    } catch {
      clearTimeout(flipTimer)
      setBallPhase('idle')
      setErrorMsg('The oracle is clouded. Check your API key and try again.')
      setAppPhase('error')
    }
  }

  function reset() {
    abortRef.current?.abort()
    setMovie(null)
    setErrorMsg('')
    setAppPhase('idle')
    setBallPhase('idle')
  }

  const movieTitle = movie?.title ?? ''
  const movieYear = movie?.release_date?.slice(0, 4) ?? ''
  const isLoading = appPhase === 'loading'

  return (
    <div className="app">
      {/* ── Floating title ── */}
      <header className="title-wrap">
        <div className="title-filmstrip">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="title-filmstrip-hole" />
          ))}
          <div className="title-filmstrip-bar" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i + 4} className="title-filmstrip-hole" />
          ))}
        </div>

        <h1 className="title-main">REEL INTENT</h1>
        <p className="title-sub">The Movie Oracle</p>

        <div className="title-filmstrip" style={{ transform: 'scaleX(-1)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="title-filmstrip-hole" />
          ))}
          <div className="title-filmstrip-bar" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i + 4} className="title-filmstrip-hole" />
          ))}
        </div>
      </header>

      {/* ── Filters ── */}
      <div className={['filter-panel-outer', appPhase === 'revealed' ? 'filter-hidden' : ''].join(' ')}>
        <FilterPanel
          genres={genres}
          selectedGenreId={selectedGenreId}
          selectedLanguage={selectedLanguage}
          selectedPeriod={selectedPeriod}
          onGenreChange={setSelectedGenreId}
          onLanguageChange={setSelectedLanguage}
          onPeriodChange={setSelectedPeriod}
          disabled={isLoading}
        />
      </div>

      {/* ── Magic 8-ball ── */}
      <EightBall
        phase={ballPhase}
        movieTitle={movieTitle}
        movieYear={movieYear}
      />

      {/* ── Error / empty states ── */}
      {appPhase === 'error' && (
        <p className="oracle-error">{errorMsg}</p>
      )}
      {appPhase === 'empty' && (
        <p className="oracle-error">
          The oracle finds no films matching your fate.<br />Try different signs.
        </p>
      )}

      {/* ── Consult button (hidden when revealed) ── */}
      {appPhase !== 'revealed' && (
        <button
          className="oracle-btn"
          onClick={consultOracle}
          disabled={isLoading}
        >
          {isLoading ? '— consulting —' : '✦ Consult the Oracle ✦'}
        </button>
      )}

      {/* ── Movie reveal card ── */}
      {appPhase === 'revealed' && movie && (
        <MovieReveal movie={movie} genres={genres} onReset={reset} />
      )}
    </div>
  )
}
