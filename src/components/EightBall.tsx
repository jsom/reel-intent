import { useEffect, useState } from 'react'

export type BallPhase = 'idle' | 'shaking' | 'flipping' | 'revealed'

interface EightBallProps {
  phase: BallPhase
  movieTitle: string
  movieYear: string
}

export default function EightBall({ phase, movieTitle, movieYear }: EightBallProps) {
  const [displayedTitle, setDisplayedTitle] = useState('')
  const [showYear, setShowYear] = useState(false)

  // Typewriter effect for the movie title in the window
  useEffect(() => {
    if (phase !== 'revealed') {
      setDisplayedTitle('')
      setShowYear(false)
      return
    }
    let i = 0
    setDisplayedTitle('')
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        i++
        setDisplayedTitle(movieTitle.slice(0, i))
        if (i >= movieTitle.length) {
          clearInterval(interval)
          setTimeout(() => setShowYear(true), 300)
        }
      }, 60)
      return () => clearInterval(interval)
    }, 400)
    return () => clearTimeout(timer)
  }, [phase, movieTitle])

  const isFloating = phase === 'idle'
  const isShaking = phase === 'shaking'
  const isFlipped = phase === 'flipping' || phase === 'revealed'

  return (
    <div className="ball-scene">
      <div
        className={[
          'ball-wrapper',
          isFloating ? 'ball-floating' : '',
          isShaking ? 'ball-shaking' : '',
        ].join(' ')}
      >
        <div className={['ball-body', isFlipped ? 'ball-flipped' : ''].join(' ')}>

          {/* Front face — the "8" */}
          <div className="ball-face ball-front">
            <div className="ball-highlight" />
            <div className="ball-eight-circle">
              <span className="ball-eight-text">8</span>
            </div>
          </div>

          {/* Back face — the answer window */}
          <div className="ball-face ball-back">
            <div className="ball-highlight ball-highlight-back" />
            <div className="ball-answer-window">
              {phase === 'revealed' ? (
                <div className="ball-answer-content">
                  <div className="ball-answer-title">{displayedTitle}</div>
                  {showYear && (
                    <div className="ball-answer-year">{movieYear}</div>
                  )}
                </div>
              ) : (
                <div className="ball-answer-dots">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
