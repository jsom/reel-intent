const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string

export interface Genre {
  id: number
  name: string
}

export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  original_language: string
  genre_ids: number[]
  total_results?: number
}

export interface TimePeriod {
  label: string
  from: number
  to: number
}

export interface Language {
  code: string
  label: string
}

export const TIME_PERIODS: TimePeriod[] = [
  { label: 'Golden Age (1920–1959)', from: 1920, to: 1959 },
  { label: 'New Wave (1960–1979)', from: 1960, to: 1979 },
  { label: 'Blockbuster Era (1980s)', from: 1980, to: 1989 },
  { label: 'Indie Revolution (1990s)', from: 1990, to: 1999 },
  { label: 'Digital Age (2000s)', from: 2000, to: 2009 },
  { label: 'Streaming Era (2010s)', from: 2010, to: 2019 },
  { label: 'Now Playing (2020s)', from: 2020, to: new Date().getFullYear() },
]

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
]

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB error ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchGenres(): Promise<Genre[]> {
  const data = await tmdb<{ genres: Genre[] }>('/genre/movie/list')
  return data.genres
}

export interface FetchResult {
  movie: Movie | null
  totalResults: number
}

export async function fetchRandomMovie(
  genreId: number | null,
  language: string | null,
  period: TimePeriod | null,
  minStars: number,
): Promise<FetchResult> {
  // When vote_average.gte is already a quality signal, relax vote_count.gte
  // so we don't collapse the pool. A film rated 8/10 by 50 people is more
  // trustworthy than one rated 6/10 by 50 people.
  const voteFloor = minStars >= 4 ? 50 : minStars >= 2 ? 100 : 200

  const params: Record<string, string> = {
    sort_by: 'vote_count.desc',
    'vote_count.gte': String(voteFloor),
    include_adult: 'false',
  }
  if (genreId) params.with_genres = String(genreId)
  if (language) params.with_original_language = language
  if (period) {
    params['primary_release_date.gte'] = `${period.from}-01-01`
    params['primary_release_date.lte'] = `${period.to}-12-31`
  }
  if (minStars > 0) params['vote_average.gte'] = String(minStars * 2)

  const first = await tmdb<{ results: Movie[]; total_pages: number; total_results: number }>(
    '/discover/movie',
    { ...params, page: '1' },
  )

  const totalResults = first.total_results ?? 0
  if (!first.results.length) return { movie: null, totalResults }

  const maxPage = Math.min(first.total_pages, 500)
  const randomPage = Math.floor(Math.random() * maxPage) + 1

  const page =
    randomPage === 1
      ? first
      : await tmdb<{ results: Movie[] }>('/discover/movie', {
          ...params,
          page: String(randomPage),
        })

  if (!page.results.length) return { movie: null, totalResults }

  const shuffled = [...page.results].sort(() => Math.random() - 0.5)
  return { movie: shuffled[0], totalResults }
}

export function posterUrl(path: string): string {
  return `${IMG_BASE}${path}`
}
