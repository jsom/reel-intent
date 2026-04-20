import { useEffect, useRef, useState } from 'react'

export type BallPhase = 'idle' | 'shaking' | 'flipping' | 'revealed'

interface EightBallProps {
  phase: BallPhase
  movieTitle: string
  movieYear: string
  onClick?: () => void
}

const S      = 56   // ball canvas px  → displayed at 280px (5× scale)
const GLOW_S = 64   // glow canvas px  → displayed at 320px (5× scale)

const ANIM_MS = 3200  // total animation duration

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1)
}

// ─── Shared helpers ────────────────────────────────────────────

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

function fillArc(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number) {
  ctx.fillStyle = color
  arc(ctx, x, y, r)
  ctx.fill()
}

// Pixel-art "8" drawn with explicit fillRect blocks
function drawEight(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const px = 1.5 * s
  const x = cx - 2.5 * px
  const y = cy - 3.5 * px
  const p = (dx: number, dy: number) => ctx.fillRect(x + dx * px, y + dy * px, px, px)
  ctx.fillStyle = '#090816'
  p(1,0); p(2,0); p(3,0)
  p(0,1); p(4,1)
  p(0,2); p(4,2)
  p(1,3); p(2,3); p(3,3)
  p(0,4); p(4,4)
  p(0,5); p(4,5)
  p(1,6); p(2,6); p(3,6)
}

// Sphere shading layers — used by every draw call
function drawSphereBase(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  fillArc(ctx, '#030208', cx,       cy,       19*s)
  fillArc(ctx, '#0c0820', cx,       cy,       18*s)
  fillArc(ctx, '#05030e', cx + 3*s, cy + 3*s, 15*s)
  fillArc(ctx, '#0c0820', cx,       cy,       11*s)
  fillArc(ctx, '#1c1244', cx - 4*s, cy - 4*s, 10*s)
  fillArc(ctx, '#3d2478', cx - 6*s, cy - 6*s,  7*s)
  fillArc(ctx, '#6848a8', cx - 8*s, cy - 8*s,  4*s)
  fillArc(ctx, '#9870c8', cx - 9*s, cy - 9*s,  2*s)
  fillArc(ctx, '#080610', cx + 1*s, cy + 2*s,  8*s)
  fillArc(ctx, '#0c0820', cx,       cy,         6*s)
}

// ─── Static states ─────────────────────────────────────────────

function drawIdle(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / 40
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2, cy = canvas.height / 2
  drawSphereBase(ctx, cx, cy, s)
  fillArc(ctx, '#c8c8d8', cx + 1*s, cy + 1*s, 9*s + 0.5)
  fillArc(ctx, '#eeeefc', cx,       cy,        9*s)
  drawEight(ctx, cx, cy, s)
}

function drawRevealed(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / 40
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2, cy = canvas.height / 2
  drawSphereBase(ctx, cx, cy, s)
  const r = 9 * s
  fillArc(ctx, '#030a1c', cx + 1*s, cy + 1*s, r + 0.5)
  fillArc(ctx, '#040e28', cx,       cy,        r)
  ctx.strokeStyle = '#1a3a6a'
  ctx.lineWidth = 0.8 * s
  arc(ctx, cx, cy, r * 0.88)
  ctx.stroke()
}

// ─── Animated frame ────────────────────────────────────────────
//
// Timeline (elapsed 0 → ANIM_MS):
//   0   – SHAKE_END  : shake CSS active, "8" spins fast, dark ink builds
//   SHAKE_END – ANIM_MS : shake stops, ink swirls slow & clear, circle turns blue

function drawFrame(canvas: HTMLCanvasElement, elapsed: number) {
  const ctx = canvas.getContext('2d')!
  const s = canvas.width / 40
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2, cy = canvas.height / 2
  const sec = elapsed / 1000

  drawSphereBase(ctx, cx, cy, s)

  const t = Math.min(elapsed / ANIM_MS, 1)

  // Ink density: ramps up over first half, clears over second half
  const inkBuild = Math.min(t * 2, 1)                      // 0 → 1
  const inkClear = Math.max((t - 0.5) * 2, 0)              // 0 → 1
  const inkDensity = inkBuild * (1 - inkClear * 0.95)      // peak at t=0.5

  // Circle colour: white → dark blue (driven by clear phase)
  const cR = Math.round(lerp(238, 3,  inkClear))
  const cG = Math.round(lerp(238, 10, inkClear))
  const cB = Math.round(lerp(252, 28, inkClear))
  const circleR = 9 * s

  fillArc(ctx, `rgb(${Math.round(cR*.85)},${Math.round(cG*.85)},${Math.round(cB*.85)})`,
          cx + 1*s, cy + 1*s, circleR + 0.5)
  fillArc(ctx, `rgb(${cR},${cG},${cB})`, cx, cy, circleR)

  // Dark ink clouds inside the circle
  if (inkDensity > 0.02) {
    ctx.save()
    arc(ctx, cx, cy, circleR)
    ctx.clip()

    // Spin speed drops from fast (shaking) to slow (settling)
    const spinSpeed = lerp(2.8, 0.4, inkClear)
    const numBlobs = 5
    for (let i = 0; i < numBlobs; i++) {
      const base = (i / numBlobs) * Math.PI * 2
      const angle = base + sec * spinSpeed + i * 0.4
      const orbit = circleR * lerp(0.42, 0.1, inkDensity)
      const bx = cx + Math.cos(angle) * orbit
      const by = cy + Math.sin(angle) * orbit
      const br = circleR * lerp(0.28, 0.58, inkDensity)
      ctx.fillStyle = `rgba(8, 6, 20, ${inkDensity * 0.85})`
      arc(ctx, bx, by, br)
      ctx.fill()
    }
    ctx.restore()
  }

  // "8" rotates and fades as ink builds
  const eightAlpha = Math.max(1 - inkBuild * 1.9, 0)
  if (eightAlpha > 0) {
    // Rotation accelerates while shaking, freezes as ink peaks
    const spinAngle = sec * lerp(2.0, 0.2, inkBuild)
    ctx.save()
    ctx.globalAlpha = eightAlpha
    ctx.translate(cx, cy)
    ctx.rotate(spinAngle)
    ctx.translate(-cx, -cy)
    drawEight(ctx, cx, cy, s)
    ctx.restore()
  }

  // Blue window rim fades in as ink clears
  if (inkClear > 0.25) {
    const rimAlpha = Math.min((inkClear - 0.25) / 0.75, 1)
    ctx.strokeStyle = `rgba(26, 58, 106, ${rimAlpha})`
    ctx.lineWidth = 0.8 * s
    arc(ctx, cx, cy, circleR * 0.88)
    ctx.stroke()
  }
}

// ─── Glow canvas ───────────────────────────────────────────────

function drawGlow(canvas: HTMLCanvasElement, isBlue: boolean) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, GLOW_S, GLOW_S)
  const cx = GLOW_S / 2, cy = GLOW_S / 2
  const ballR = 27
  const rgb = isBlue ? '59, 130, 246' : '139, 92, 246'
  const rings = [
    { dr: 1, a: 0.72 }, { dr: 2, a: 0.40 },
    { dr: 3, a: 0.18 }, { dr: 4, a: 0.06 },
  ]
  for (const { dr, a } of rings) {
    ctx.strokeStyle = `rgba(${rgb}, ${a})`
    ctx.lineWidth = 1
    arc(ctx, cx, cy, ballR + dr)
    ctx.stroke()
  }
}

// ─── Component ─────────────────────────────────────────────────

export default function EightBall({ phase, movieTitle, movieYear, onClick }: EightBallProps) {
  const ballRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)
  const animStartRef = useRef<number | null>(null)
  // Stable ref so the rAF loop always reads the latest phase
  const phaseRef = useRef<BallPhase>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  const [displayedTitle, setDisplayedTitle] = useState('')
  const [showYear, setShowYear] = useState(false)

  // Animation loop — starts when shaking begins, runs until animation ends
  // or phase resets to idle. Using isAnimating as dep avoids restarting
  // the loop on shaking→flipping (both are "animating").
  const isAnimating = phase !== 'idle'
  useEffect(() => {
    if (!isAnimating) {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
      animStartRef.current = null
      if (ballRef.current) drawIdle(ballRef.current)
      return
    }

    // Fresh animation start (idle → shaking)
    animStartRef.current = null

    function loop(ts: number) {
      if (!animStartRef.current) animStartRef.current = ts
      const elapsed = ts - animStartRef.current

      if (ballRef.current) drawFrame(ballRef.current, elapsed)

      if (elapsed < ANIM_MS && phaseRef.current !== 'idle') {
        animRef.current = requestAnimationFrame(loop)
      } else {
        // Natural end or forced reset
        if (ballRef.current && phaseRef.current !== 'idle') {
          drawRevealed(ballRef.current)
        }
      }
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current)
        animRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating])

  // Glow colour
  useEffect(() => {
    if (glowRef.current) {
      drawGlow(glowRef.current, phase === 'flipping' || phase === 'revealed')
    }
  }, [phase])

  // Typewriter text for revealed state
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
  const isShaking = phase === 'shaking'

  return (
    <div
      className={['ball-scene', isIdle && onClick ? 'ball-clickable' : ''].join(' ')}
      onClick={isIdle ? onClick : undefined}
    >
      <canvas ref={glowRef} width={GLOW_S} height={GLOW_S} className="ball-glow-canvas" />

      <div className={['ball-wrapper', isIdle ? 'ball-floating' : '', isShaking ? 'ball-shaking' : ''].join(' ')}>
        <div className="ball-face">
          <canvas ref={ballRef} width={S} height={S} className="ball-canvas" />

          {phase === 'revealed' && (
            <div className="ball-answer-window">
              <div className="ball-answer-content">
                <div className="ball-answer-title">{displayedTitle}</div>
                {showYear && <div className="ball-answer-year">{movieYear}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
