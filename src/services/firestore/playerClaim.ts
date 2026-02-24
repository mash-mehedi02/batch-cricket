import { db, auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '@/config/firebase'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
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

    // 4. Sync User Profile in 'users' collection for persistent session state
    const userRef = doc(db, 'users', uid)
    const playerData = playerSnap.data()
    await updateDoc(userRef, {
        role: 'player',
        playerId: playerId,
        isRegisteredPlayer: true,
        displayName: playerData.name || user.displayName,
        photoURL: playerData.photoUrl || user.photoURL,
        updatedAt: serverTimestamp()
    }).catch(e => console.error('[Claim] User profile sync failed:', e))

    return { success: true, email: googleEmail }
}

/**
 * Verify access based on current Auth state and 1-hour session
 */
export async function verifyPlayerAccess(player: any): Promise<{ hasAccess: boolean; isExpired: boolean }> {
    if (!auth.currentUser || !player) {
        return { hasAccess: false, isExpired: false }
    }

    // 1. Check direct UID binding
    const isOwnerByUid = player.claimed && player.ownerUid === auth.currentUser.uid;

    // 2. Fallback: Check if email matches (for immediate access after auto-link)
    // We get the secret email from the player doc if it's there (admin sets it)
    const normalizedUserEmail = auth.currentUser.email?.toLowerCase().trim();
    const normalizedPlayerEmail = player.email?.toLowerCase().trim();
    const isOwnerByEmail = normalizedUserEmail && normalizedPlayerEmail && normalizedUserEmail === normalizedPlayerEmail;

    if (!isOwnerByUid && !isOwnerByEmail) {
        return { hasAccess: false, isExpired: false }
    }

    // If ownerUid matches current user, access is granted persistently
    if (isOwnerByUid) {
        return { hasAccess: true, isExpired: false }
    }

    // Sessions for email fallback (if needed)
    if (isOwnerByEmail && !player.lastVerifiedAt) return { hasAccess: true, isExpired: false }
    if (!player.lastVerifiedAt) return { hasAccess: false, isExpired: true }

    const lastVerified = player.lastVerifiedAt.toMillis ? player.lastVerifiedAt.toMillis() : player.lastVerifiedAt
    const isExpired = (Date.now() - lastVerified) > 72 * 3600000 // Fallback session length (3 days)

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
        school?: string
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
 * Admin: Update Player Claim Email (SECURE)
 * Direct Firestore writes with full cleanup.
 * 
 * What happens:
 * 1. Validates no duplicate email exists
 * 2. Updates player_secrets with new email
 * 3. Resets player claim (ownerUid = null, claimed = false)
 * 4. Unlinks old user from player
 * 5. Writes audit log
 * 
 * Old email loses ALL access. New email can claim the profile.
 */
export async function updatePlayerClaimEmail(playerId: string, newEmail: string) {
    if (!auth.currentUser) {
        throw new Error('Must be logged in as admin')
    }

    const email = newEmail.trim().toLowerCase()
    const maskedEmail = maskEmail(email)
    const adminUid = auth.currentUser.uid
    const adminEmail = auth.currentUser.email || ''

    // === STEP 1: Duplicate email check (STRICT) ===
    const isTaken = await isEmailRegistered(email, playerId)
    if (isTaken) {
        throw new Error('This email is already assigned to another player. Duplicate emails are not allowed.')
    }

    // === STEP 2: Fetch current player data ===
    const playerRef = doc(db, 'players', playerId)
    const playerSnap = await getDoc(playerRef)
    if (!playerSnap.exists()) throw new Error('Player not found')

    const playerData = playerSnap.data()
    const oldOwnerUid = playerData.ownerUid || null
    const playerName = playerData.name || 'Unknown'

    // Fetch old email for audit
    const secretRef = doc(db, 'player_secrets', playerId)
    const secretSnap = await getDoc(secretRef)
    const oldEmail = secretSnap.exists() ? secretSnap.data()?.email : null

    // If email hasn't changed, skip
    if (oldEmail && oldEmail.toLowerCase() === email) {
        return { success: true, noChange: true }
    }

    // === STEP 3: Batch write — atomic update ===
    const batch = writeBatch(db)

    // Update player_secrets with new email
    batch.set(secretRef, {
        playerId,
        email,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid
    }, { merge: true })

    // Reset player ownership
    batch.update(playerRef, {
        maskedEmail,
        claimed: false,
        ownerUid: null,
        lastVerifiedAt: null,
        updatedAt: serverTimestamp()
    })

    await batch.commit()

    // === STEP 4: Unlink old user (if player was claimed) ===
    if (oldOwnerUid) {
        try {
            const oldUserRef = doc(db, 'users', oldOwnerUid)
            const oldUserSnap = await getDoc(oldUserRef)
            if (oldUserSnap.exists()) {
                const oldUserData = oldUserSnap.data()
                if (oldUserData?.linkedPlayerId === playerId || oldUserData?.playerId === playerId) {
                    await updateDoc(oldUserRef, {
                        linkedPlayerId: null,
                        playerId: null,
                        isRegisteredPlayer: false,
                        role: oldUserData.role === 'player' ? 'viewer' : oldUserData.role,
                        playerProfile: null,
                        updatedAt: serverTimestamp()
                    })
                    console.log('[Security] Old user unlinked:', oldOwnerUid)
                }
            }
        } catch (unlinkErr) {
            console.error('[Security] Old user unlink warning:', unlinkErr)
        }
    }

    // === STEP 5: Cleanup stale user references ===
    try {
        const staleUsers = await getDocs(
            query(collection(db, 'users'), where('linkedPlayerId', '==', playerId))
        )
        for (const userDoc of staleUsers.docs) {
            const userData = userDoc.data()
            if (userData.email?.toLowerCase() !== email) {
                await updateDoc(userDoc.ref, {
                    linkedPlayerId: null,
                    playerId: null,
                    isRegisteredPlayer: false,
                    role: userData.role === 'player' ? 'viewer' : userData.role,
                    playerProfile: null,
                    updatedAt: serverTimestamp()
                })
            }
        }
    } catch (staleErr) {
        console.error('[Security] Stale cleanup warning:', staleErr)
    }

    // === STEP 6: Audit log ===
    try {
        await addDoc(collection(db, 'audit_logs'), {
            actionType: 'UPDATE_EMAIL',
            playerId,
            playerName,
            oldEmail,
            newEmail: email,
            oldOwnerUid,
            adminId: adminUid,
            adminEmail,
            timestamp: serverTimestamp()
        })
    } catch (auditErr) {
        console.error('[Audit] Log write warning:', auditErr)
    }

    console.log(`[Security] Email changed: ${oldEmail} → ${email} for player ${playerId}`)
    return { success: true }
}

/**
 * Admin: Check if email is already used (STRICT - multi-collection check)
 * 
 * Checks:
 * 1. player_secrets collection (primary source of truth)
 * 2. users collection (for users linked to different players)
 * 
 * Returns true if email is taken by another player.
 */
export async function isEmailRegistered(email: string, excludePlayerId?: string): Promise<boolean> {
    if (!email) return false
    const emailLower = email.trim().toLowerCase()

    // Check 1: player_secrets
    const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower))
    const snap = await getDocs(q)

    if (!snap.empty) {
        const hasDuplicate = snap.docs.some(d => d.id !== excludePlayerId)
        if (hasDuplicate) return true
    }

    // Check 2: users collection for linked players
    const usersQ = query(collection(db, 'users'), where('email', '==', emailLower))
    const usersSnap = await getDocs(usersQ)

    if (!usersSnap.empty) {
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data()
            if (userData.linkedPlayerId && userData.linkedPlayerId !== excludePlayerId) {
                return true
            }
        }
    }

    return false
}

/**
 * Admin: Secure Player Deletion (Direct Firestore)
 * 
 * Full atomic cleanup:
 * 1. Player document permanently deleted
 * 2. Player secrets deleted  
 * 3. Player removed from squad
 * 4. Ownership references cleared from user doc
 * 5. Audit log created
 * 
 * After deletion: old email sign-in creates completely new account.
 */
export async function adminDeletePlayerSecure(playerId: string) {
    if (!auth.currentUser) {
        throw new Error('Must be logged in as admin')
    }

    const adminUid = auth.currentUser.uid
    const adminEmail = auth.currentUser.email || ''

    // === STEP 1: Fetch player data before deletion ===
    const playerRef = doc(db, 'players', playerId)
    const playerSnap = await getDoc(playerRef)
    if (!playerSnap.exists()) throw new Error('Player not found')

    const playerData = playerSnap.data()
    const playerName = playerData.name || 'Unknown'
    const ownerUid = playerData.ownerUid || null
    const squadId = playerData.squadId || null

    // Fetch secret email for audit
    const secretRef = doc(db, 'player_secrets', playerId)
    const secretSnap = await getDoc(secretRef)
    const secretEmail = secretSnap.exists() ? secretSnap.data()?.email : null

    // === STEP 2: Delete player + secrets (batch) ===
    const batch = writeBatch(db)
    batch.delete(playerRef)
    if (secretSnap.exists()) {
        batch.delete(secretRef)
    }
    await batch.commit()

    // === STEP 3: Remove from squad ===
    if (squadId) {
        try {
            const squadRef = doc(db, 'squads', squadId)
            const squadSnap = await getDoc(squadRef)
            if (squadSnap.exists()) {
                const currentPlayerIds = squadSnap.data()?.playerIds || []
                await updateDoc(squadRef, {
                    playerIds: currentPlayerIds.filter((pid: string) => pid !== playerId)
                })
            }
        } catch (squadErr) {
            console.error('[Security] Squad cleanup warning:', squadErr)
        }
    }

    // === STEP 4: Unlink from user document ===
    if (ownerUid) {
        try {
            const userRef = doc(db, 'users', ownerUid)
            const userSnap = await getDoc(userRef)
            if (userSnap.exists()) {
                const userData = userSnap.data()
                if (userData?.linkedPlayerId === playerId || userData?.playerId === playerId) {
                    await updateDoc(userRef, {
                        linkedPlayerId: null,
                        playerId: null,
                        isRegisteredPlayer: false,
                        role: userData.role === 'player' ? 'viewer' : userData.role,
                        playerProfile: null,
                        updatedAt: serverTimestamp()
                    })
                    console.log('[Security] Owner user unlinked:', ownerUid)
                }
            }
        } catch (unlinkErr) {
            console.error('[Security] User unlink warning:', unlinkErr)
        }
    }

    // === STEP 5: Sweep for orphaned user references ===
    try {
        const orphanedUsers = await getDocs(
            query(collection(db, 'users'), where('linkedPlayerId', '==', playerId))
        )
        for (const userDoc of orphanedUsers.docs) {
            const userData = userDoc.data()
            await updateDoc(userDoc.ref, {
                linkedPlayerId: null,
                playerId: null,
                isRegisteredPlayer: false,
                role: userData.role === 'player' ? 'viewer' : userData.role,
                playerProfile: null,
                updatedAt: serverTimestamp()
            })
        }
        if (!orphanedUsers.empty) {
            console.log(`[Security] Cleaned ${orphanedUsers.size} orphaned user references`)
        }
    } catch (orphanErr) {
        console.error('[Security] Orphan cleanup warning:', orphanErr)
    }

    // === STEP 6: Audit log ===
    try {
        await addDoc(collection(db, 'audit_logs'), {
            actionType: 'DELETE_PLAYER',
            playerId,
            playerName,
            oldEmail: secretEmail,
            oldOwnerUid: ownerUid,
            adminId: adminUid,
            adminEmail,
            timestamp: serverTimestamp(),
            metadata: { squadId }
        })
    } catch (auditErr) {
        console.error('[Audit] Log write warning:', auditErr)
    }

    console.log(`[Security] Player ${playerId} (${playerName}) deleted securely by ${adminEmail}`)
    return { success: true, message: `Player "${playerName}" deleted. All ownership cleared.` }
}
