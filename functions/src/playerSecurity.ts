/**
 * Player Email Ownership & Security System
 * ==========================================
 * Production-grade identity rebinding system for BatchCrick BD.
 *
 * CORE RULES:
 * 1. Player email = ownership binding identity
 * 2. Admin delete → wipes all ownership references clean
 * 3. Admin email change → atomic rebind (old email loses access, new email gains it)
 * 4. Duplicate emails are IMPOSSIBLE
 * 5. All actions are audit-logged
 * 6. ONLY Cloud Functions can modify ownership fields (never client)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================================
// HELPER: Verify caller is an active admin
// ============================================================
async function verifyAdmin(context: functions.https.CallableContext): Promise<{ uid: string; email: string; role: string }> {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email || '';

    // Check admins collection
    const adminDoc = await db.collection('admins').doc(uid).get();

    if (!adminDoc.exists || adminDoc.data()?.isActive !== true) {
        // Check super admin by email
        const SUPER_ADMIN_EMAILS = ['batchcrick@gmail.com', 'mehedihasan110571@gmail.com', 'faysalmia4125@gmail.com'];
        if (!SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required');
        }
    }

    const role = adminDoc.exists ? (adminDoc.data()?.role || 'admin') : 'super_admin';
    return { uid, email, role };
}

// ============================================================
// HELPER: Write Audit Log
// ============================================================
async function writeAuditLog(data: {
    actionType: 'DELETE_PLAYER' | 'UPDATE_EMAIL' | 'OWNERSHIP_RESET' | 'PLAYER_UNLINK';
    playerId: string;
    playerName?: string;
    oldEmail?: string | null;
    newEmail?: string | null;
    oldOwnerUid?: string | null;
    adminId: string;
    adminEmail: string;
    metadata?: Record<string, any>;
}) {
    try {
        await db.collection('audit_logs').add({
            ...data,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString(),
        });
        console.log(`[Audit] ${data.actionType} | Player: ${data.playerId} | Admin: ${data.adminEmail}`);
    } catch (err) {
        // Never fail the main operation because of audit logging
        console.error('[Audit] Failed to write audit log:', err);
    }
}

// ============================================================
// CLOUD FUNCTION: Secure Player Deletion
// ============================================================
/**
 * When admin deletes a player:
 *
 * 1. Delete the player document
 * 2. Delete the player_secrets document
 * 3. Remove playerId from squad's playerIds array
 * 4. If player had an ownerUid → clear linkedPlayerId, playerId, isRegisteredPlayer from user doc
 * 5. Write audit log
 *
 * After this:
 * - If old email signs in again → treated as completely new user (no player link)
 * - ZERO ghost access
 */
export const adminDeletePlayer = functions.https.onCall(async (data, context) => {
    // 1. Verify admin
    const adminInfo = await verifyAdmin(context);

    const { playerId } = data;
    if (!playerId || typeof playerId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }

    try {
        // 2. Fetch player data before deletion (for audit + cleanup)
        const playerRef = db.collection('players').doc(playerId);
        const playerSnap = await playerRef.get();

        if (!playerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Player not found');
        }

        const playerData = playerSnap.data()!;
        const playerName = playerData.name || 'Unknown';
        const ownerUid = playerData.ownerUid || null;
        const squadId = playerData.squadId || null;

        // Verify admin owns this player (unless super admin)
        if (adminInfo.role !== 'super_admin') {
            if (playerData.adminId !== adminInfo.uid && playerData.createdBy !== adminInfo.uid) {
                throw new functions.https.HttpsError('permission-denied', 'You can only delete players you created');
            }
        }

        // 3. Fetch secret email for audit
        const secretRef = db.collection('player_secrets').doc(playerId);
        const secretSnap = await secretRef.get();
        const secretEmail = secretSnap.exists ? secretSnap.data()?.email : null;

        // 4. Execute deletion in a Firestore transaction for atomicity
        await db.runTransaction(async (transaction) => {
            // Delete player document
            transaction.delete(playerRef);

            // Delete player_secrets document
            if (secretSnap.exists) {
                transaction.delete(secretRef);
            }

            // Remove from squad's playerIds
            if (squadId) {
                const squadRef = db.collection('squads').doc(squadId);
                const squadSnap = await transaction.get(squadRef);
                if (squadSnap.exists) {
                    const currentPlayerIds = squadSnap.data()?.playerIds || [];
                    transaction.update(squadRef, {
                        playerIds: currentPlayerIds.filter((pid: string) => pid !== playerId)
                    });
                }
            }

            // Unlink from user document if claimed
            if (ownerUid) {
                const userRef = db.collection('users').doc(ownerUid);
                const userSnap = await transaction.get(userRef);
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    // Only unlink if user is actually linked to THIS player
                    if (userData?.linkedPlayerId === playerId || userData?.playerId === playerId) {
                        transaction.update(userRef, {
                            linkedPlayerId: null,
                            playerId: null,
                            isRegisteredPlayer: false,
                            role: userData.role === 'player' ? 'viewer' : userData.role,
                            playerProfile: null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }
        });

        // 5. Also check if ANY user references this playerId (edge case: ownerUid was stale)
        try {
            const usersWithLink = await db.collection('users')
                .where('linkedPlayerId', '==', playerId)
                .get();

            const batch = db.batch();
            let batchCount = 0;
            usersWithLink.forEach(userDoc => {
                const userData = userDoc.data();
                batch.update(userDoc.ref, {
                    linkedPlayerId: null,
                    playerId: null,
                    isRegisteredPlayer: false,
                    role: userData.role === 'player' ? 'viewer' : userData.role,
                    playerProfile: null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                batchCount++;
            });

            if (batchCount > 0) {
                await batch.commit();
                console.log(`[Security] Unlinked ${batchCount} orphaned user references for player ${playerId}`);
            }
        } catch (orphanErr) {
            console.error('[Security] Orphan cleanup warning:', orphanErr);
        }

        // 6. Audit log
        await writeAuditLog({
            actionType: 'DELETE_PLAYER',
            playerId,
            playerName,
            oldEmail: secretEmail,
            oldOwnerUid: ownerUid,
            adminId: adminInfo.uid,
            adminEmail: adminInfo.email,
            metadata: { squadId }
        });

        console.log(`[Security] Player ${playerId} (${playerName}) deleted by admin ${adminInfo.email}`);
        return { success: true, message: `Player "${playerName}" deleted. All ownership references cleared.` };

    } catch (error: any) {
        if (error.code && error.details) throw error; // Re-throw HttpsError
        console.error('[Security] Delete Player Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete player securely');
    }
});

// ============================================================
// CLOUD FUNCTION: Secure Email Update
// ============================================================
/**
 * When admin changes a player's email:
 *
 * VALIDATION:
 * 1. Check new email is not already used by another player (player_secrets)
 * 2. Check new email is not already bound to a claimed account (players where email matches)
 * 3. Check new email is not already in users collection as a linked player
 *
 * If validation passes:
 * 1. Update player_secrets with new email
 * 2. Update player doc: maskedEmail, reset claimed=false, ownerUid=null
 * 3. Clear linkedPlayerId from OLD user (if was claimed)
 * 4. Write audit log
 *
 * After this:
 * - Old email (mehedi@gmail.com) signs in → NEW user, no player access
 * - New email (mehedihasan@gmail.com) signs in → auto-links to existing player profile
 */
export const adminUpdatePlayerEmail = functions.https.onCall(async (data, context) => {
    // 1. Verify admin
    const adminInfo = await verifyAdmin(context);

    const { playerId, newEmail } = data;
    if (!playerId || typeof playerId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }
    if (!newEmail || typeof newEmail !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'newEmail is required');
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
    }

    try {
        // 2. Fetch current player data
        const playerRef = db.collection('players').doc(playerId);
        const playerSnap = await playerRef.get();

        if (!playerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Player not found');
        }

        const playerData = playerSnap.data()!;
        const playerName = playerData.name || 'Unknown';
        const oldOwnerUid = playerData.ownerUid || null;

        // Verify admin owns this player
        if (adminInfo.role !== 'super_admin') {
            if (playerData.adminId !== adminInfo.uid && playerData.createdBy !== adminInfo.uid) {
                throw new functions.https.HttpsError('permission-denied', 'You can only modify players you created');
            }
        }

        // 3. Fetch old email
        const secretRef = db.collection('player_secrets').doc(playerId);
        const secretSnap = await secretRef.get();
        const oldEmail = secretSnap.exists ? secretSnap.data()?.email : null;

        // If email hasn't changed, no-op
        if (oldEmail && oldEmail.toLowerCase() === normalizedEmail) {
            return { success: true, message: 'Email unchanged', noChange: true };
        }

        // ============================================================
        // DUPLICATE EMAIL VALIDATION (STRICT)
        // ============================================================

        // Check 1: Is this email already in player_secrets for ANOTHER player?
        const existingSecrets = await db.collection('player_secrets')
            .where('email', '==', normalizedEmail)
            .get();

        const duplicateSecret = existingSecrets.docs.find(doc => doc.id !== playerId);
        if (duplicateSecret) {
            throw new functions.https.HttpsError(
                'already-exists',
                `This email is already assigned to another player (ID: ${duplicateSecret.id}). Duplicate emails are not allowed.`
            );
        }

        // Check 2: Is this email already linked to a user who has a DIFFERENT player?
        const usersWithEmail = await db.collection('users')
            .where('email', '==', normalizedEmail)
            .get();

        for (const userDoc of usersWithEmail.docs) {
            const userData = userDoc.data();
            if (userData.linkedPlayerId && userData.linkedPlayerId !== playerId) {
                throw new functions.https.HttpsError(
                    'already-exists',
                    `This email is already associated with a user who has a different player profile. Cannot assign duplicate email.`
                );
            }
        }

        // ============================================================
        // ATOMIC EMAIL UPDATE TRANSACTION
        // ============================================================
        const maskedEmail = maskEmailServer(normalizedEmail);

        await db.runTransaction(async (transaction) => {
            // Update player_secrets with new email
            transaction.set(secretRef, {
                playerId,
                email: normalizedEmail,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: adminInfo.uid
            }, { merge: true });

            // Update player document: reset ownership
            transaction.update(playerRef, {
                maskedEmail,
                claimed: false,
                ownerUid: null,
                lastVerifiedAt: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Unlink from OLD user if player was claimed
            if (oldOwnerUid) {
                const oldUserRef = db.collection('users').doc(oldOwnerUid);
                const oldUserSnap = await transaction.get(oldUserRef);

                if (oldUserSnap.exists) {
                    const oldUserData = oldUserSnap.data();
                    // Only unlink if this user was linked to THIS player
                    if (oldUserData?.linkedPlayerId === playerId || oldUserData?.playerId === playerId) {
                        transaction.update(oldUserRef, {
                            linkedPlayerId: null,
                            playerId: null,
                            isRegisteredPlayer: false,
                            role: oldUserData.role === 'player' ? 'viewer' : oldUserData.role,
                            playerProfile: null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }
        });

        // Also cleanup any other users that might have stale references
        try {
            const staleUsers = await db.collection('users')
                .where('linkedPlayerId', '==', playerId)
                .get();

            const batch = db.batch();
            let batchCount = 0;
            staleUsers.forEach(userDoc => {
                const userData = userDoc.data();
                // Don't unlink the NEW email user if they already exist
                if (userData.email?.toLowerCase() !== normalizedEmail) {
                    batch.update(userDoc.ref, {
                        linkedPlayerId: null,
                        playerId: null,
                        isRegisteredPlayer: false,
                        role: userData.role === 'player' ? 'viewer' : userData.role,
                        playerProfile: null,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    batchCount++;
                }
            });

            if (batchCount > 0) {
                await batch.commit();
                console.log(`[Security] Cleaned ${batchCount} stale user links for player ${playerId}`);
            }
        } catch (staleErr) {
            console.error('[Security] Stale cleanup warning:', staleErr);
        }

        // Audit log
        await writeAuditLog({
            actionType: 'UPDATE_EMAIL',
            playerId,
            playerName,
            oldEmail,
            newEmail: normalizedEmail,
            oldOwnerUid,
            adminId: adminInfo.uid,
            adminEmail: adminInfo.email,
        });

        console.log(`[Security] Email changed for player ${playerId}: ${oldEmail} → ${normalizedEmail} by ${adminInfo.email}`);

        return {
            success: true,
            message: `Email updated successfully. Old email access revoked. Player "${playerName}" can now be claimed with the new email.`
        };

    } catch (error: any) {
        if (error.code && error.details) throw error;
        console.error('[Security] Update Email Error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update email securely');
    }
});

// ============================================================
// CLOUD FUNCTION: Validate Email Availability
// ============================================================
/**
 * Strict server-side email availability check.
 * Checks across: player_secrets, users collection
 */
export const validateEmailAvailability = functions.https.onCall(async (data, context) => {
    await verifyAdmin(context);

    const { email, excludePlayerId } = data;
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check player_secrets
    const secretsQuery = await db.collection('player_secrets')
        .where('email', '==', normalizedEmail)
        .get();

    const secretConflict = secretsQuery.docs.find(doc => doc.id !== excludePlayerId);
    if (secretConflict) {
        return {
            available: false,
            reason: 'This email is already assigned to another player profile.'
        };
    }

    // Check users collection for linked players with different linkage
    const usersQuery = await db.collection('users')
        .where('email', '==', normalizedEmail)
        .get();

    for (const userDoc of usersQuery.docs) {
        const userData = userDoc.data();
        if (userData.linkedPlayerId && userData.linkedPlayerId !== excludePlayerId) {
            return {
                available: false,
                reason: 'This email belongs to a user already linked to a different player.'
            };
        }
    }

    return { available: true };
});

// ============================================================
// HELPER: Server-side email masking
// ============================================================
function maskEmailServer(email: string): string {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const [local, domain] = parts;
    if (local.length <= 2) return `${local}****@${domain}`;
    return `${local.slice(0, 2)}****@${domain}`;
}
