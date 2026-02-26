/**
 * Global Image Preloader
 * Caches images in memory so they appear instantly on subsequent renders.
 */

// Global cache — survives across component mounts/unmounts
const imageCache = new Map<string, string>()     // url → 'loaded' | 'error'
const inFlight = new Map<string, Promise<void>>() // url → pending promise

/**
 * Preload a single image URL into the browser cache.
 * Returns a promise that resolves when the image is cached.
 */
export function preloadImage(url: string): Promise<void> {
    if (!url || typeof url !== 'string') return Promise.resolve()

    // Already cached
    if (imageCache.has(url)) return Promise.resolve()

    // Already loading — reuse the existing promise
    if (inFlight.has(url)) return inFlight.get(url)!

    const promise = new Promise<void>((resolve) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
            imageCache.set(url, 'loaded')
            inFlight.delete(url)
            resolve()
        }
        img.onerror = () => {
            imageCache.set(url, 'error')
            inFlight.delete(url)
            resolve() // Resolve anyway so callers don't hang
        }
        img.src = url
    })

    inFlight.set(url, promise)
    return promise
}

/**
 * Preload multiple image URLs in parallel.
 */
export function preloadImages(urls: (string | undefined | null)[]): Promise<void[]> {
    const validUrls = urls.filter((u): u is string => !!u && typeof u === 'string')
    return Promise.all(validUrls.map(preloadImage))
}

/**
 * Check if an image URL has been preloaded successfully.
 */
export function isImageCached(url: string | undefined | null): boolean {
    if (!url) return false
    return imageCache.get(url) === 'loaded'
}

/**
 * Get the status of an image URL: 'loaded' | 'error' | 'loading' | 'unknown'
 */
export function getImageStatus(url: string | undefined | null): 'loaded' | 'error' | 'loading' | 'unknown' {
    if (!url) return 'unknown'
    if (imageCache.has(url)) return imageCache.get(url) as 'loaded' | 'error'
    if (inFlight.has(url)) return 'loading'
    return 'unknown'
}
