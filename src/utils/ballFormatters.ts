/**
 * Ball Display Formatters
 * Utility functions for formatting ball displays
 */

export function getBallColor(type: string): string {
  const colors: Record<string, string> = {
    wicket: '#ef4444',
    six: '#10b981',
    four: '#3b82f6',
    wide: '#fbbf24',
    noball: '#f97316',
    dot: '#6b7280',
    run: '#0ea5e9',
  }
  return colors[type] || colors.run
}

