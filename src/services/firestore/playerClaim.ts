import { db, auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '@/config/firebase'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore'
import { Capacitor } from '@capacitor/core'

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
 * Check for pending redirect results (Call this on app load or profile mount)
 */
export async function handleGoogleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            console.log('[Auth] Redirect result found:', result.user.email);
            return result;
        }
    } catch (error) {
        console.error('[Auth] Redirect error:', error);
    }
    return null;
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
    adminId?: string
    adminEmail?: string
}) {
    if (!auth.currentUser) {
        throw new Error('Must be logged in as admin')
    }

    const { name, squadId, school, adminId, adminEmail, ...rest } = playerData
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
        createdBy: auth.currentUser.uid,
        adminId: adminId || auth.currentUser.uid,
        adminEmail: adminEmail || auth.currentUser.email
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
        provider.setCustomParameters({ prompt: 'select_account' })

        let result;
        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            console.log('[Auth] Native platform detected, using Native Google Auth');
            try {
                const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

                await GoogleAuth.initialize({
                    clientId: '899272110972-pjfti5ug438ubliit4ri5civ6nuhkftv.apps.googleusercontent.com',
                    scopes: ['profile', 'email'],
                });

                // Force account selection by signing out first
                try {
                    await GoogleAuth.signOut();
                } catch (e) {
                    // Ignore sign out errors if not logged in
                }

                const googleUser = await GoogleAuth.signIn();

                if (!googleUser.authentication.idToken) {
                    throw new Error('No ID token returned from Google Auth');
                }

                const { signInWithCredential, GoogleAuthProvider } = await import('@/config/firebase');
                const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);

                // Sign in directly and finish everything HERE. 
                // DO NOT let the execution flow out of this 'isNative' block into any shared logic.
                const userCredential = await signInWithCredential(auth, credential);
                if (userCredential.user) {
                    console.log('[Auth] Native login success, finalizing claim...');
                    // This will throw "Access Denied" if email is wrong
                    return await finalizeClaim(playerId, userCredential.user);
                }
                return { success: false };
            } catch (err: any) {
                console.error('[Auth] Native Google Auth failed:', err);
                // Just throw the error. Do NOT redirect to browser in native app.
                throw err;
            }
        } else {
            // Web environment
            try {
                result = await signInWithPopup(auth, provider);
            } catch (err: any) {
                if (err.code === 'auth/popup-blocked' || err.code === 'auth/internal-error') {
                    console.warn('[Auth] Popup blocked or failed, falling back to redirect');
                    localStorage.setItem('pending_claim_player_id', playerId);
                    await signInWithRedirect(auth, provider);
                    return { pending: true };
                }
                throw err;
            }
        }

        if (!result) return { success: false };

        return await finalizeClaim(playerId, result.user);
    } catch (error: any) {
        console.error('Google claim failed:', error)
        throw error
    }
}

/**
 * Finalize the binding between Google account and Player profile
 */
export async function finalizeClaim(playerId: string, user: any) {
    const googleEmail = user.email?.toLowerCase()
    const uid = user.uid

    if (!googleEmail) {
        throw new Error('No email returned from Google. Access denied.')
    }

    // 1. Fetch player status
    const playerRef = doc(db, 'players', playerId)
    const playerSnap = await getDoc(playerRef)
    if (!playerSnap.exists()) throw new Error('Player not found')

    // 2. Verify Google Email against secret record
    const secretRef = doc(db, 'player_secrets', playerId)
    const secretSnap = await getDoc(secretRef)

    if (!secretSnap.exists()) {
        throw new Error('Security record missing. Please contact admin to set your registration email.')
    }

    const registeredEmail = secretSnap.data().email?.toLowerCase()

    if (googleEmail !== registeredEmail) {
        // Cleanup if wrong account
        try {
            const adminSnap = await getDoc(doc(db, 'admins', uid));
            if (!adminSnap.exists()) {
                await user.delete();
            }
        } catch (cleanupErr) {
            console.warn('Silent cleanup failed:', cleanupErr);
        }

        throw new Error(`Access Denied: It looks like this is not your profile. Your Google account (${googleEmail}) does not match our records for this player.`)
    }

    // 3. Success -> Bind profile
    await updateDoc(playerRef, {
        claimed: true,
        ownerUid: uid,
        lastVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    })

    return { success: true, email: googleEmail }
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
        name?: string
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
