/**
 * Player Claim Service - Passwordless Google Sign-In Implementation
 * BatchCrick BD - Secure Player Profiles
 */

import { db, auth, GoogleAuthProvider, signInWithPopup } from '@/config/firebase'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore'

/**
 * Mask Email for Display
 * me*********57@gmail.com
 */
export function maskEmail(email: string): string {
    if (!email) return ''
    const parts = email.split('@')
    if (parts.length !== 2) return email

    const [local, domain] = parts
    if (local.length <= 2) {
        return `${local}****@${domain}`
    }
    return `${local.slice(0, 2)}****@${domain}`
}

/**
 * Admin: Create Player with Google Email requirement
 */
export async function createPlayerWithClaim(playerData: {
    name: string
    squadId: string
    squadName: string
    school: string
    email: string
    role?: string
    battingStyle?: string
    bowlingStyle?: string
    dateOfBirth?: string
    photoUrl?: string
    address?: string
}) {
    if (!auth.currentUser) {
        throw new Error('Must be logged in as admin')
    }

    const { name, squadId, school, ...rest } = playerData
    const email = playerData.email.trim().toLowerCase()
    const maskedEmail = maskEmail(email)

    const playerRef = doc(collection(db, 'players'))
    const playerId = playerRef.id

    const publicData = {
        id: playerId,
        name,
        squadId,
        school,
        role: rest.role || 'batsman',
        battingStyle: rest.battingStyle || null,
        bowlingStyle: rest.bowlingStyle || null,
        dateOfBirth: rest.dateOfBirth || null,
        photoUrl: rest.photoUrl || null,
        address: rest.address || null,

        // Claim fields
        claimed: false,
        maskedEmail,
        ownerUid: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
    }

    // Secret document stores the raw email
    const secretRef = doc(db, 'player_secrets', playerId)
    const secretData = {
        playerId,
        email,
        createdAt: serverTimestamp()
    }

    try {
        await setDoc(playerRef, publicData)
        await setDoc(secretRef, secretData)

        // Update squad
        const squadRef = doc(db, 'squads', squadId)
        const squadDoc = await getDoc(squadRef)
        if (squadDoc.exists()) {
            const currentPlayerIds = squadDoc.data().playerIds || []
            await updateDoc(squadRef, {
                playerIds: [...currentPlayerIds, playerId]
            })
        }

        return {
            success: true,
            playerId
        }
    } catch (error) {
        console.error('Player creation failed:', error)
        throw error
    }
}

/**
 * Player: Claim Profile via Google Sign-In
 */
export async function claimPlayerWithGoogle(playerId: string) {
    try {
        const provider = new GoogleAuthProvider()
        // Force account selection to avoid accidental logic with wrong account
        provider.setCustomParameters({ prompt: 'select_account' })

        const result = await signInWithPopup(auth, provider)
        const googleEmail = result.user.email?.toLowerCase()
        const uid = result.user.uid

        if (!googleEmail) {
            throw new Error('No email returned from Google. Access denied.')
        }

        // 1. Fetch player status
        const playerRef = doc(db, 'players', playerId)
        const playerSnap = await getDoc(playerRef)
        if (!playerSnap.exists()) throw new Error('Player not found')

        // 2. Verify Google Email against secret record
        const secretRef = doc(db, 'player_secrets', playerId)
        let registeredEmail: string | undefined;

        try {
            const secretSnap = await getDoc(secretRef)
            if (!secretSnap.exists()) {
                throw new Error('Security record missing. Please contact admin to set your registration email.')
            }
            registeredEmail = secretSnap.data().email?.toLowerCase()
        } catch (error: any) {
            // If Firestore denies read, it's because the emails don't match (see firestore.rules)
            if (error.code === 'permission-denied') {
                throw new Error(`Access Denied: Your Google account (${googleEmail}) does not match the email registered for this player profile.`)
            }
            throw error
        }

        if (googleEmail !== registeredEmail) {
            throw new Error(`This Google account (${googleEmail}) does not match the registered player email.`)
        }

        // 3. Success -> Bind profile & Set Session
        await updateDoc(playerRef, {
            claimed: true,
            ownerUid: uid,
            lastVerifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        })

        return { success: true, email: googleEmail }
    } catch (error: any) {
        console.error('Google claim failed:', error)
        throw error
    }
}

/**
 * Verify access based on current Auth state and 1-hour session
 */
export async function verifyPlayerAccess(player: any): Promise<{ hasAccess: boolean; isExpired: boolean }> {
    if (!auth.currentUser || !player || !player.claimed || player.ownerUid !== auth.currentUser.uid) {
        return { hasAccess: false, isExpired: false }
    }

    if (!player.lastVerifiedAt) return { hasAccess: false, isExpired: true }

    // Check if 1 hour (3600000 ms) has passed since last verification
    const lastVerified = player.lastVerifiedAt.toMillis ? player.lastVerifiedAt.toMillis() : player.lastVerifiedAt
    const isExpired = (Date.now() - lastVerified) > 3600000

    return { hasAccess: !isExpired, isExpired }
}

/**
 * Update Player Personal Info (Post-Claim)
 */
export async function updatePlayerPersonalInfo(
    playerId: string,
    updates: {
        username?: string
        bio?: string
        photoUrl?: string
        dateOfBirth?: string
        socialLinks?: any[]
        role?: string
        battingStyle?: string
        bowlingStyle?: string
        address?: string
    }
) {
    if (!auth.currentUser) {
        throw new Error('Authentication required')
    }

    try {
        const playerRef = doc(db, 'players', playerId)
        const playerSnap = await getDoc(playerRef)

        if (!playerSnap.exists()) {
            throw new Error('Player not found')
        }

        const playerData = playerSnap.data()
        const { hasAccess, isExpired } = await verifyPlayerAccess(playerData)

        if (!hasAccess) {
            throw new Error(isExpired ? 'Session expired. Please re-verify your identity.' : 'Unauthorized access.')
        }

        // Update Public Data
        await updateDoc(playerRef, {
            ...updates,
            updatedAt: serverTimestamp()
        })

        return { success: true }
    } catch (error: any) {
        console.error('Update failed:', error)
        throw error
    }
}

/**
 * Admin: Get Player Secret Email
 */
export async function getPlayerSecretEmail(playerId: string) {
    const secretRef = doc(db, 'player_secrets', playerId)
    const secretSnap = await getDoc(secretRef)
    if (secretSnap.exists()) {
        return secretSnap.data().email as string
    }
    return null
}

/**
 * Admin: Update Player Claim Email (Before or After Claim)
 * If after claim, this effectively revokes access if email changes
 */
export async function updatePlayerClaimEmail(playerId: string, newEmail: string) {
    const email = newEmail.trim().toLowerCase()
    const maskedEmail = maskEmail(email)

    const secretRef = doc(db, 'player_secrets', playerId)
    await setDoc(secretRef, {
        email,
        updatedAt: serverTimestamp()
    }, { merge: true })

    const playerRef = doc(db, 'players', playerId)

    // If setting a new email, we reset the claim to ensure new owner verification
    await updateDoc(playerRef, {
        maskedEmail,
        claimed: false, // Reset claim status
        ownerUid: null, // Revoke current owner
        updatedAt: serverTimestamp()
    })

    return { success: true }
}
