/**
 * App Update Service
 * Checks Firestore for latest version and compares with current app version.
 * Super admin can set update info via admin dashboard.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'

// ⚠️ IMPORTANT: Update this every time you build a new APK
export const APP_VERSION = '1.0.2'

export interface AppUpdateInfo {
    latestVersion: string
    downloadUrl: string
    releaseNotes: string
    isForceUpdate: boolean
    updatedAt?: any
    updatedBy?: string
}

const DEFAULT_UPDATE_INFO: AppUpdateInfo = {
    latestVersion: APP_VERSION,
    downloadUrl: '',
    releaseNotes: '',
    isForceUpdate: false,
}

/**
 * Compare two semver version strings (e.g. "1.0.2" vs "1.0.3")
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0
        const nb = pb[i] || 0
        if (na < nb) return -1
        if (na > nb) return 1
    }
    return 0
}

class AppUpdateService {
    private cachedInfo: AppUpdateInfo | null = null

    /**
     * Fetch the latest update info from Firestore
     */
    async getUpdateInfo(): Promise<AppUpdateInfo> {
        try {
            const docRef = doc(db, 'app_config', 'update')
            const snap = await getDoc(docRef)
            if (snap.exists()) {
                this.cachedInfo = snap.data() as AppUpdateInfo
                return this.cachedInfo
            }
            return DEFAULT_UPDATE_INFO
        } catch (error) {
            console.error('[AppUpdate] Failed to fetch update info:', error)
            return this.cachedInfo || DEFAULT_UPDATE_INFO
        }
    }

    /**
     * Check if an update is available
     */
    async isUpdateAvailable(): Promise<{ available: boolean; info: AppUpdateInfo }> {
        const info = await this.getUpdateInfo()
        const available = compareVersions(APP_VERSION, info.latestVersion) < 0
        return { available, info }
    }

    /**
     * Save update info (admin only)
     */
    async saveUpdateInfo(info: Partial<AppUpdateInfo>, adminUid: string): Promise<void> {
        const docRef = doc(db, 'app_config', 'update')
        await setDoc(docRef, {
            ...info,
            updatedAt: serverTimestamp(),
            updatedBy: adminUid,
        }, { merge: true })
        this.cachedInfo = null // Clear cache
    }

    /**
     * Check if user has dismissed this version's popup
     */
    hasDismissedVersion(version: string): boolean {
        const dismissed = localStorage.getItem('dismissed_update_version')
        return dismissed === version
    }

    /**
     * Mark current version popup as dismissed
     */
    dismissVersion(version: string): void {
        localStorage.setItem('dismissed_update_version', version)
    }

    /**
     * Get current app version
     */
    getCurrentVersion(): string {
        return APP_VERSION
    }
}

export const appUpdateService = new AppUpdateService()
