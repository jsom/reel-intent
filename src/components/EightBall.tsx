import { useEffect, useRef, useState } from 'react'

export type BallPhase = 'idle' | 'shaking' | 'flipping' | 'revealed'

interface EightBallProps {
  phase: BallPhase
  movieTitle: string
  movieYear: string
}

// Canvas is drawn at this size and displayed at 280×280 (7× scale).
// The 7× upscale with image-rendering: pixelated gives every canvas
// pixel a 7×7 block on screen — true 8-bit look.
const S = 40

function fill(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

// Pixel-art "8" drawn as explicit fillRect blocks so it upscales cleanly
function drawEight(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const px = 1.5 // 1 "pixel" in canvas units
  ctx.fillStyle = '#090816'
  const x = cx - 2.5 * px
  const y = cy - 3.5 * px
  const p = (dx: number, dy: number) => ctx.fillRect(x + dx * px, y + dy * px, px, px)
  //  .XXX.
  p(1, 0); p(2, 0); p(3, 0)
  //  X...X
  p(0, 1); p(4, 1)
  //  X...X
  p(0, 2); p(4, 2)
  //  .XXX.
  p(1, 3); p(2, 3); p(3, 3)
  //  X...X
  p(0, 4); p(4, 4)
  //  X...X
  p(0, 5); p(4, 5)
  //  .XXX.
  p(1, 6); p(2, 6); p(3, 6)
}

function drawFront(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  const cx = S / 2, cy = S / 2

  // Outermost border ring
  fill(ctx, '#030208', cx, cy, 19)
  // Main sphere body (dark purple-black)
  fill(ctx, '#0c0820', cx, cy, 18)
  // Bottom-right shadow zone
  fill(ctx, '#05030e', cx + 3, cy + 3, 15)
  // Re-fill center to blend
  fill(ctx, '#0c0820', cx, cy, 11)
  // Highlight zone 1 (top-left, large)
  fill(ctx, '#1c1244', cx - 4, cy - 4, 10)
  // Highlight zone 2
  fill(ctx, '#3d2478', cx - 6, cy - 6, 7)
  // Bright highlight
  fill(ctx, '#6848a8', cx - 8, cy - 8, 4)
  // Specular spot
  fill(ctx, '#9870c8', cx - 9, cy - 9, 2)
  // Darken center back to keep ball moody
  fill(ctx, '#080610', cx + 1, cy + 2, 8)
  fill(ctx, '#0c0820', cx, cy, 6)

  // White "8" circle — offset shadow then main
  fill(ctx, '#c8c8d8', cx + 1, cy + 1, 9)
  fill(ctx, '#eeeefc', cx, cy, 9)

  drawEight(ctx, cx, cy)
}

function drawBack(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, S, S)
  const cx = S / 2, cy = S / 2

  // Border ring
  fill(ctx, '#010408', cx, cy, 19)
  // Main sphere body (dark blue-black)
  fill(ctx, '#060e1c', cx, cy, 18)
  // Bottom-left shadow (highlight is top-right for the "other side")
  fill(ctx, '#030810', cx - 3, cy + 3, 15)
  fill(ctx, '#060e1c', cx, cy, 11)
  // Highlight zone 1 (top-right, mirrored)
  fill(ctx, '#0e1e3c', cx + 4, cy - 4, 10)
  fill(ctx, '#1a3460', cx + 6, cy - 6, 7)
  fill(ctx, '#2a4e88', cx + 8, cy - 8, 4)
  fill(ctx, '#3a68a8', cx + 9, cy - 9, 2)
  // Darken center
  fill(ctx, '#04090f', cx - 1, cy + 2, 8)
  fill(ctx, '#060e1c', cx, cy, 6)

  // Answer window
  fill(ctx, '#030c22', cx, cy, 11)
  fill(ctx, '#040e28', cx, cy, 10)
  // Window rim — draw as a ring using stroke
  ctx.strokeStyle = '#1a3a6a'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(cx, cy, 10.5, 0, Math.PI * 2)
  ctx.stroke()
}

export default function EightBall({ phase, movieTitle, movieYear }: EightBallProps) {
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const [displayedTitle, setDisplayedTitle] = useState('')
  const [showYear, setShowYear] = useState(false)

  useEffect(() => {
    if (frontRef.current) drawFront(frontRef.current)
    if (backRef.current) drawBack(backRef.current)
  }, [])

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

  const isFloating = phase === 'idle'
  const isShaking = phase === 'shaking'
  const isFlipped = phase === 'flipping' || phase === 'revealed'

  return (
    <div className="ball-scene">
      <div className={['ball-wrapper', isFloating ? 'ball-floating' : '', isShaking ? 'ball-shaking' : ''].join(' ')}>
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
