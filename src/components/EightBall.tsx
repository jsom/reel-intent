import { useEffect, useRef, useState } from 'react'

export type BallPhase = 'idle' | 'shaking' | 'flipping' | 'revealed'

interface EightBallProps {
  phase: BallPhase
  movieTitle: string
  movieYear: string
  onClick?: () => void
}

// Ball canvas: 56×56 displayed at 280×280 (5× scale).
const S = 56

// Glow canvas: 64×64 displayed at 320×320 (same 5× scale).
// The 4 extra canvas pixels on each side hold the glow rings.
// Drawing arcs at this resolution then upscaling with image-rendering:pixelated
// produces stairstepped pixel-art rings — circular but grid-quantised.
const GLOW_S = 64

function drawGlow(canvas: HTMLCanvasElement, isBlue: boolean) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, GLOW_S, GLOW_S)
  const cx = GLOW_S / 2, cy = GLOW_S / 2
  // Ball radius in the 56-wide ball canvas is 27; scale to GLOW_S.
  const ballR = 27 * (GLOW_S / 56)
  const rgb = isBlue ? '59, 130, 246' : '139, 92, 246'
  // Four 1-canvas-pixel-wide rings = four 5px-wide rings on screen.
  const rings = [
    { dr: 1, a: 0.72 },
    { dr: 2, a: 0.40 },
    { dr: 3, a: 0.18 },
    { dr: 4, a: 0.06 },
  ]
  for (const { dr, a } of rings) {
    ctx.strokeStyle = `rgba(${rgb}, ${a})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, ballR + dr, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function fill(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

// All coordinates are expressed as multiples of `s` (= S/40) so the
// design scales cleanly if S ever changes.
function drawEight(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const px = 1.5 * s
  ctx.fillStyle = '#090816'
  const x = cx - 2.5 * px
  const y = cy - 3.5 * px
  const p = (dx: number, dy: number) => ctx.fillRect(x + dx * px, y + dy * px, px, px)
  p(1, 0); p(2, 0); p(3, 0)
  p(0, 1); p(4, 1)
  p(0, 2); p(4, 2)
  p(1, 3); p(2, 3); p(3, 3)
  p(0, 4); p(4, 4)
  p(0, 5); p(4, 5)
  p(1, 6); p(2, 6); p(3, 6)
}

function drawFront(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / 40
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2, cy = canvas.height / 2

  fill(ctx, '#030208', cx, cy, 19 * s)
  fill(ctx, '#0c0820', cx, cy, 18 * s)
  fill(ctx, '#05030e', cx + 3*s, cy + 3*s, 15 * s)
  fill(ctx, '#0c0820', cx, cy, 11 * s)
  fill(ctx, '#1c1244', cx - 4*s, cy - 4*s, 10 * s)
  fill(ctx, '#3d2478', cx - 6*s, cy - 6*s,  7 * s)
  fill(ctx, '#6848a8', cx - 8*s, cy - 8*s,  4 * s)
  fill(ctx, '#9870c8', cx - 9*s, cy - 9*s,  2 * s)
  fill(ctx, '#080610', cx + 1*s, cy + 2*s,  8 * s)
  fill(ctx, '#0c0820', cx,       cy,         6 * s)
  fill(ctx, '#c8c8d8', cx + 1*s, cy + 1*s,  9 * s)
  fill(ctx, '#eeeefc', cx,       cy,         9 * s)
  drawEight(ctx, cx, cy, s)
}

function drawBack(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / 40
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2, cy = canvas.height / 2

  fill(ctx, '#010408', cx,       cy,         19 * s)
  fill(ctx, '#060e1c', cx,       cy,         18 * s)
  fill(ctx, '#030810', cx - 3*s, cy + 3*s,  15 * s)
  fill(ctx, '#060e1c', cx,       cy,         11 * s)
  fill(ctx, '#0e1e3c', cx + 4*s, cy - 4*s,  10 * s)
  fill(ctx, '#1a3460', cx + 6*s, cy - 6*s,   7 * s)
  fill(ctx, '#2a4e88', cx + 8*s, cy - 8*s,   4 * s)
  fill(ctx, '#3a68a8', cx + 9*s, cy - 9*s,   2 * s)
  fill(ctx, '#04090f', cx - 1*s, cy + 2*s,   8 * s)
  fill(ctx, '#060e1c', cx,       cy,          6 * s)
  fill(ctx, '#030c22', cx,       cy,         11 * s)
  fill(ctx, '#040e28', cx,       cy,         10 * s)
  ctx.strokeStyle = '#1a3a6a'
  ctx.lineWidth = 0.8 * s
  ctx.beginPath()
  ctx.arc(cx, cy, 10.5 * s, 0, Math.PI * 2)
  ctx.stroke()
}

export default function EightBall({ phase, movieTitle, movieYear, onClick }: EightBallProps) {
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef  = useRef<HTMLCanvasElement>(null)
  const glowRef  = useRef<HTMLCanvasElement>(null)
  const [displayedTitle, setDisplayedTitle] = useState('')
  const [showYear, setShowYear] = useState(false)

  useEffect(() => {
    if (frontRef.current) drawFront(frontRef.current)
    if (backRef.current)  drawBack(backRef.current)
  }, [])

  // Redraw the glow whenever phase changes so purple ↔ blue tracks the flip.
  useEffect(() => {
    if (glowRef.current) {
      const isBlue = phase === 'flipping' || phase === 'revealed'
      drawGlow(glowRef.current, isBlue)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'revealed') {
      setDisplayedTitle('')
      setShowYear(false)
      return
    }
    let i = 0
    setDisplayedTitle('')
    const outer = setTimeout(() => {
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
    return () => clearTimeout(outer)
  }, [phase, movieTitle])

  const isIdle    = phase === 'idle'
  const isFlipped = phase === 'flipping' || phase === 'revealed'

  return (
    <div
      className={['ball-scene', isIdle && onClick ? 'ball-clickable' : ''].join(' ')}
      onClick={isIdle ? onClick : undefined}
    >
      {/* Glow canvas — 64×64 drawn at canvas resolution, displayed at 320×320.
          Arcs at low res upscale to stairstepped pixel-art rings (circular but
          grid-quantised), centered over the 280px ball. */}
      <canvas ref={glowRef} width={GLOW_S} height={GLOW_S} className="ball-glow-canvas" />

      <div className={['ball-wrapper', isIdle ? 'ball-floating' : '', phase === 'shaking' ? 'ball-shaking' : ''].join(' ')}>
        <div className={['ball-body', isFlipped ? 'ball-flipped' : ''].join(' ')}>

          {/* Front face — pixel-art sphere with "8" */}
          <div className="ball-face ball-front">
            <canvas ref={frontRef} width={S} height={S} className="ball-canvas" />
          </div>

          {/* Back face — pixel-art sphere with answer window */}
          <div className="ball-face ball-back">
            <canvas ref={backRef} width={S} height={S} className="ball-canvas" />
            <div className="ball-answer-window">
              {phase === 'revealed' ? (
                <div className="ball-answer-content">
                  <div className="ball-answer-title">{displayedTitle}</div>
                  {showYear && <div className="ball-answer-year">{movieYear}</div>}
                </div>
              ) : (
                <div className="ball-answer-dots">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
