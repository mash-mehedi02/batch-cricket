/**
 * URL Utilities
 */

/**
 * Ensures a URL is absolute by prepending https:// if no protocol is present.
 * Also handles cases where the user might have entered a malformed URL.
 */
export const ensureAbsoluteUrl = (url: string): string => {
    if (!url) return ''
    const trimmed = url.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed
    }
    return `https://${trimmed}`
}
