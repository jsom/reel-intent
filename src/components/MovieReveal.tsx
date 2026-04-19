import { type Movie, type Genre, posterUrl } from '../lib/tmdb'

interface MovieRevealProps {
  movie: Movie
  genres: Genre[]
  onReset: () => void
}

const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', zh: 'Mandarin',
  hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', ar: 'Arabic',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', pl: 'Polish', tr: 'Turkish',
}

function StarRating({ rating }: { rating: number }) {
  const stars = Math.round(rating / 2)
  return (
    <span className="movie-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < stars ? 'star-on' : 'star-off'}>★</span>
      ))}
      <span className="movie-rating-num">{rating.toFixed(1)}</span>
    </span>
  )
}

export default function MovieReveal({ movie, genres, onReset }: MovieRevealProps) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : '—'
  const lang = LANG_NAMES[movie.original_language] ?? movie.original_language.toUpperCase()
  const movieGenres = genres.filter((g) => movie.genre_ids.includes(g.id))

  return (
    <div className="movie-reveal">
      <div className="movie-card">
        {/* Poster */}
        <div className="movie-poster-wrap">
          {movie.poster_path ? (
            <img
              src={posterUrl(movie.poster_path)}
              alt={movie.title}
              className="movie-poster"
            />
          ) : (
            <div className="movie-poster-placeholder">
              <span>NO POSTER</span>
            </div>
          )}
          <div className="movie-poster-glow" />
        </div>

        {/* Details */}
        <div className="movie-details">
          <div className="movie-genres">
            {movieGenres.map((g) => (
              <span key={g.id} className="movie-genre-tag">{g.name}</span>
            ))}
          </div>

          <h2 className="movie-title">{movie.title}</h2>

          <div className="movie-meta">
            <span className="movie-meta-item">{year}</span>
            <span className="movie-meta-dot">·</span>
            <span className="movie-meta-item">{lang}</span>
            <span className="movie-meta-dot">·</span>
            <StarRating rating={movie.vote_average} />
          </div>

          {movie.overview && (
            <p className="movie-overview">{movie.overview}</p>
          )}

          <button className="oracle-btn oracle-btn-reset" onClick={onReset}>
            ↺ Ask Again
          </button>
        </div>
      </div>
    </div>
  )
}
