/**
 * Image Cropping Utility
 * Helper to get cropped image blob from canvas
 * Compatible with Android WebView (Capacitor)
 */

export const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => resolve(image))
        image.addEventListener('error', (error) => {
            console.error('[cropImage] Image load error:', error)
            reject(error)
        })
        // Only set crossOrigin for remote URLs — data: URLs break in Android WebView
        // when crossOrigin is set, causing tainted canvas or load failures
        if (url && !url.startsWith('data:')) {
            image.setAttribute('crossOrigin', 'anonymous')
        }
        image.src = url
    })

/**
 * Convert a base64 data URL to a Blob
 * Fallback for when canvas.toBlob() returns null (Android WebView issue)
 */
function dataURLtoBlob(dataURL: string): Blob {
    const parts = dataURL.split(',')
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
    const bstr = atob(parts[1])
    const n = bstr.length
    const u8arr = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i)
    }
    return new Blob([u8arr], { type: mime })
}

export async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob | null> {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        console.error('[cropImage] Failed to get canvas 2d context')
        return null
    }

    // set canvas size to match the desired crop
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    // draw the cropped image onto the canvas
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    // Try canvas.toBlob first, fall back to toDataURL for Android WebView compatibility
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob)
                } else {
                    // Fallback: toBlob returned null (common in some Android WebViews)
                    console.warn('[cropImage] canvas.toBlob returned null, using toDataURL fallback')
                    try {
                        const dataURL = canvas.toDataURL('image/jpeg', 0.92)
                        resolve(dataURLtoBlob(dataURL))
                    } catch (fallbackErr) {
                        console.error('[cropImage] toDataURL fallback also failed:', fallbackErr)
                        resolve(null)
                    }
                }
            }, 'image/jpeg', 0.92)
        } catch (toBlobErr) {
            // toBlob itself threw (very rare but possible on old Android)
            console.warn('[cropImage] canvas.toBlob threw, using toDataURL fallback:', toBlobErr)
            try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.92)
                resolve(dataURLtoBlob(dataURL))
            } catch (fallbackErr) {
                console.error('[cropImage] All image processing methods failed:', fallbackErr)
                resolve(null)
            }
        }
    })
}

/**
 * Get cropped image as Base64 Data URL
 * More stable for Android WebViews as it avoids Blob construction
 */
export async function getCroppedImgBase64(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
    try {
        const image = await createImage(imageSrc)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            throw new Error('Canvas context not available')
        }

        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        )

        return canvas.toDataURL('image/jpeg', 0.9)
    } catch (error: any) {
        console.error('[getCroppedImgBase64] Error:', error)
        throw new Error(error.message || 'Image processing failed')
    }
}
