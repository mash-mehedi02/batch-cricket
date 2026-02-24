/**
 * Date helpers
 * Firestore may store dates as Timestamp, Date, ISO string, or legacy strings.
 */

import type { Timestamp } from 'firebase/firestore'

function isValidDate(d: Date) {
  return !Number.isNaN(d.getTime())
}

export function coerceToDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return isValidDate(value) ? value : null
  }

  // Firestore Timestamp (duck-typed)
  if (typeof value === 'object' && value !== null && typeof (value as Timestamp).toDate === 'function') {
    try {
      const d = (value as Timestamp).toDate()
      return isValidDate(d) ? d : null
    } catch {
      return null
    }
  }

  if (typeof value === 'number') {
    const d = new Date(value)
    return isValidDate(d) ? d : null
  }

  if (typeof value === 'string') {
    // Try native parsing first (ISO, RFC, etc.)
    const d1 = new Date(value)
    if (isValidDate(d1)) return d1

    // Legacy: dd/mm/yyyy
    const m1 = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m1) {
      const [, dd, mm, yyyy] = m1
      const d2 = new Date(`${yyyy}-${mm}-${dd}T00:00:00`)
      return isValidDate(d2) ? d2 : null
    }

    // Legacy: yyyy-mm-dd
    const m2 = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m2) {
      const d3 = new Date(`${value}T00:00:00`)
      return isValidDate(d3) ? d3 : null
    }
  }

  return null
}

export function formatDateLabel(d: unknown, locale = 'en-US') {
  const date = coerceToDate(d)
  if (!date) return String(d || '')
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: BD_TIME_ZONE
  })
}

export function formatTimeLabel(d: unknown, locale = 'en-US') {
  const date = coerceToDate(d)
  if (!date) return String(d || '')
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: BD_TIME_ZONE
  })
}

// Bangladesh timezone helpers (Asia/Dhaka)
export const BD_TIME_ZONE = 'Asia/Dhaka'
// Bangladesh is UTC+6 and does not observe DST.
const BD_UTC_OFFSET_MINUTES = 6 * 60

export function formatDateLabelTZ(d: Date, timeZone = BD_TIME_ZONE, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'short', day: '2-digit' }).format(d)
}

export function formatTimeLabelTZ(d: Date, timeZone = BD_TIME_ZONE, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(d)
}

// 12-hour Bangladesh time label (e.g., 08:00 PM)
export function formatTimeLabelBD(d: Date, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: BD_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true }).format(d)
}

// Convert "HH:mm" to "hh:mm AM/PM" (display-only; assumes the stored time is already local match time)
export function formatTimeHMTo12h(time: string): string {
  const raw = String(time || '').trim()
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return raw || '—'
  let hh = Number(m[1])
  const mm = m[2]
  if (!Number.isFinite(hh)) return raw || '—'
  const ampm = hh >= 12 ? 'PM' : 'AM'
  hh = hh % 12
  if (hh === 0) hh = 12
  return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`
}

// Create a real UTC Date from Bangladesh local date+time (YYYY-MM-DD + HH:mm).
// This avoids depending on the viewer/admin device timezone for scheduling logic.
export function bdDateTimeToUtcDate(dateYMD: string, timeHM = '00:00'): Date | null {
  const d = String(dateYMD || '').trim()
  const t = String(timeHM || '').trim()
  const md = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!md) return null
  const mt = t.match(/^(\d{1,2}):(\d{2})$/)
  const yyyy = Number(md[1])
  const mm = Number(md[2])
  const dd = Number(md[3])
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
  const hh = mt ? Number(mt[1]) : 0
  const min = mt ? Number(mt[2]) : 0
  if (!Number.isFinite(hh) || !Number.isFinite(min)) return null

  // BD local -> UTC: subtract +6 hours
  const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, min, 0, 0) - BD_UTC_OFFSET_MINUTES * 60_000
  const out = new Date(utcMs)
  return isValidDate(out) ? out : null
}


