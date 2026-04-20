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

const ANIMATION_MS = 3200

export default function App() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null)
  const [minStars, setMinStars] = useState(0)

  const [appPhase, setAppPhase] = useState<AppPhase>('idle')
  const [ballPhase, setBallPhase] = useState<BallPhase>('idle')
  const [movie, setMovie] = useState<Movie | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [poolSize, setPoolSize] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {})
  }, [])

  async function consultOracle() {
    if (appPhase === 'loading') return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setMovie(null)
    setErrorMsg('')
    setPoolSize(null)
    setAppPhase('loading')
    setBallPhase('shaking')

    const flipTimer = setTimeout(() => setBallPhase('flipping'), 1600)

    try {
      const [result] = await Promise.all([
        fetchRandomMovie(selectedGenreId, selectedLanguage, selectedPeriod, minStars),
        new Promise((r) => setTimeout(r, ANIMATION_MS)),
      ])

      clearTimeout(flipTimer)

      const { movie: picked, totalResults } = result as Awaited<ReturnType<typeof fetchRandomMovie>>
      setPoolSize(totalResults)

      if (!picked) {
        setBallPhase('idle')
        setAppPhase('empty')
        return
      }

      setMovie(picked)
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
    setPoolSize(null)
    setAppPhase('idle')
    setBallPhase('idle')
  }

  const movieTitle = movie?.title ?? ''
  const movieYear = movie?.release_date?.slice(0, 4) ?? ''
  const isLoading = appPhase === 'loading'
  const tinyPool = poolSize !== null && poolSize > 0 && poolSize < 20

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

        <h1 className="title-main">TEENAH'S MOVIE TIME</h1>
        <p className="title-sub">Let Fate Decide</p>

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
          minStars={minStars}
          onGenreChange={setSelectedGenreId}
          onLanguageChange={setSelectedLanguage}
          onPeriodChange={setSelectedPeriod}
          onMinStarsChange={setMinStars}
          disabled={isLoading}
        />
      </div>

      {/* ── Magic 8-ball ── */}
      <EightBall
        phase={ballPhase}
        movieTitle={movieTitle}
        movieYear={movieYear}
        onClick={consultOracle}
      />

      {/* Hint text — only visible in idle state, fades with the ball */}
      {appPhase === 'idle' && (
        <p className="ball-hint">tap the oracle</p>
      )}

      {/* ── Small pool warning ── */}
      {tinyPool && appPhase === 'revealed' && (
        <p className="pool-warning">
          ⚠ Only {poolSize} film{poolSize === 1 ? '' : 's'} matched — loosen your filters for more variety
        </p>
      )}

      {/* ── Error / empty states ── */}
      {appPhase === 'error' && (
        <p className="oracle-error">{errorMsg}</p>
      )}
      {appPhase === 'empty' && (
        <p className="oracle-error">
          The oracle finds no films matching your fate.<br />Try different signs.
        </p>
      )}

      {/* ── Movie reveal card ── */}
      {appPhase === 'revealed' && movie && (
        <MovieReveal movie={movie} genres={genres} onReset={reset} />
      )}
    </div>
  )
}
