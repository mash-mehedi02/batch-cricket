import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

// Initialize admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// --------------------------------------------------------
// EMAIL CONFIGURATION
// TODO: Admin must configure these credentials in Firebase Environment config
// or replace directly here for production.
// Example: firebase functions:config:set email.user="..." email.pass="..."
// --------------------------------------------------------
const getTransporter = () => {
    // Falling back to a placeholder or using environment variables
    const user = process.env.EMAIL_USER || 'batchcrick@gmail.com';
    const pass = process.env.EMAIL_PASS || 'gocf vzpf kbjt qlqh';

    return nodemailer.createTransport({
        service: 'gmail', // Change if using SendGrid/others
        auth: { user, pass }
    });
};

/**
 * Generate a strict security code:
 * "BatchCrick" + FirstLetterName + FirstLetterSquad + 4 random alphanumeric chars
 */
function generateSecurityCode(name: string, squadName: string): string {
    const prefix = "BatchCrick";
    const nameChar = (name.trim().charAt(0) || 'X').toUpperCase();
    const squadChar = (squadName.trim().charAt(0) || 'X').toUpperCase();

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix}${nameChar}${squadChar}${randomPart}`;
}

/**
 * Hash utility using SHA-256
 */
function hashSecurityCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Mask email for public display
 * Rules: Show first 2, hide middle with ****, show domain.
 */
function maskEmail(email: string): string {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email; // Fallback

    const [local, domain] = parts;
    if (local.length <= 2) {
        return `${local}****@${domain}`;
    }
    // Show first 2
    return `${local.slice(0, 2)}****@${domain}`;
}

/**
 * Cloud Function: Create Player with Invite (Admin Only)
 * Creates player profile, secrets, and sends invite email.
 */
export const createPlayerWithInvite = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { name, squadId, school, email, role, battingStyle, bowlingStyle, dateOfBirth, photoUrl } = data;

    if (!name || !squadId || !email || !school) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: name, squadId, school, email');
    }

    try {
        // 2. Fetch Squad Name
        const squadDoc = await db.collection('squads').doc(squadId).get();
        if (!squadDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Squad not found');
        }
        const squadName = squadDoc.data()?.name || 'Squad';

        // 3. Generate Security Code
        const securityCode = generateSecurityCode(name, squadName);
        const securityCodeHash = hashSecurityCode(securityCode);
        const masked = maskEmail(email);

        // 4. Create Player Doc (Public)
        const playerRef = db.collection('players').doc();
        const playerId = playerRef.id;

        const now = admin.firestore.Timestamp.now();

        const publicData = {
            id: playerId, // Store ID in doc too
            name,
            role: role || 'batsman',
            squadId,
            school,
            battingStyle: battingStyle || null,
            bowlingStyle: bowlingStyle || null,
            dateOfBirth: dateOfBirth || null,
            photoUrl: photoUrl || null,

            // Claim Fields
            claimed: false,
            maskedEmail: masked,
            ownerUid: null,

            createdAt: now,
            updatedAt: now,
            createdBy: context.auth.uid
        };

        // 5. Create Secret Doc (Private)
        const secretRef = db.collection('player_secrets').doc(playerId);
        const secretData = {
            playerId,
            email,
            securityCodeHash,
            createdAt: now
        };

        const batch = db.batch();
        batch.set(playerRef, publicData);
        batch.set(secretRef, secretData);

        // Update Squad player list
        const squadRef = db.collection('squads').doc(squadId);
        batch.update(squadRef, {
            playerIds: admin.firestore.FieldValue.arrayUnion(playerId)
        });

        await batch.commit();

        // 6. Send Email
        try {
            const transporter = getTransporter();
            await transporter.sendMail({
                from: '"BatchCrick BD" <noreply@batchcrick.com>',
                to: email,
                subject: 'BatchCrick BD – Your Profile Claim Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                        <h2 style="color: #0f766e; text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 10px;">BatchCrick BD</h2>
                        <p style="font-size: 16px; color: #333;">Hello <strong>${name}</strong>,</p>
                        <p style="color: #555;">An official player profile has been created for you. You can now claim this profile to manage your photo, bio, and social links.</p>
                        
                        <div style="background-color: #f0fdfa; border: 1px dashed #0f766e; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Security Code</p>
                            <span style="font-size: 28px; font-weight: bold; letter-spacing: 3px; color: #115e59; font-family: monospace;">${securityCode}</span>
                        </div>

                        <p style="color: #ef4444; font-weight: bold; text-align: center;">⚠️ DO NOT SHARE THIS CODE</p>

                        <h3 style="color: #333;">How to Claim Your Profile:</h3>
                        <ol style="color: #555; line-height: 1.6;">
                            <li>Log in to <strong>BatchCrick BD</strong> using this email (${email}).</li>
                            <li>Go to your profile page.</li>
                            <li>Click the <strong>"Claim Profile"</strong> button.</li>
                            <li>Enter the code above when prompted.</li>
                        </ol>

                        <p style="color: #555; margin-top: 30px;">Welcome to the squad!</p>
                        <p style="color: #888; font-size: 12px; margin-top: 20px; text-align: center;">This is an automated message from BatchCrick BD Admin.</p>
                    </div>
                `
            });
            console.log(`[Email Sent] To: ${email}, Code: ${securityCode}`);
        } catch (mailError) {
            console.error('[Email Failed]', mailError);
            // We do NOT rollback transaction. The player is created. Admin can see the code in logs if needed or regenerated (future feature).
        }

        return { success: true, playerId };

    } catch (error) {
        console.error('[CreatePlayer Error]', error);
        throw new functions.https.HttpsError('internal', 'Failed to create player');
    }
});

/**
 * Cloud Function: Claim Player Profile
 * Verifies code and claims the profile.
 */
export const claimPlayerProfile = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { playerId, code } = data;
    const uid = context.auth.uid;
    const userEmail = context.auth.token.email;

    if (!playerId || !code) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing playerId or code');
    }
    if (!userEmail) {
        throw new functions.https.HttpsError('failed-precondition', 'User does not have a verified email');
    }

    try {
        // 2. Fetch Docs
        const secretDocRef = db.collection('player_secrets').doc(playerId);
        const secretDoc = await secretDocRef.get();

        const playerRef = db.collection('players').doc(playerId);
        const playerDoc = await playerRef.get();

        if (!secretDoc.exists || !playerDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Profile not found');
        }

        const secretData = secretDoc.data();
        const playerData = playerDoc.data();

        // 3. Status Check
        if (playerData?.claimed) {
            throw new functions.https.HttpsError('already-exists', 'Profile is already claimed');
        }

        // 4. Verification
        // Verify Email
        if (secretData?.email !== userEmail) {
            console.warn(`[Claim Fail] Email mismatch. User: ${userEmail}, Target: ${secretData?.email}`);
            throw new functions.https.HttpsError('permission-denied', 'Verification failed');
        }

        // Verify Code
        const inputHash = hashSecurityCode(code);
        // Note: In future, if player changed code, we might check an 'updatedSecurityCodeHash' or similar, 
        // but for initial claim, we check the one we generated.
        if (inputHash !== secretData?.securityCodeHash) {
            console.warn(`[Claim Fail] Code mismatch for player ${playerId}`);
            throw new functions.https.HttpsError('permission-denied', 'Verification failed');
        }

        // 5. Update Status
        const batch = db.batch();

        batch.update(playerRef, {
            claimed: true,
            ownerUid: uid,
            updatedAt: admin.firestore.Timestamp.now()
        });

        // We can optionally verify the user matches the email in Auth, which we did.

        await batch.commit();

        console.log(`[Claim Success] Player ${playerId} claimed by ${uid} (${userEmail})`);
        return { success: true };

    } catch (error: any) {
        console.error('[Claim Error]', error);
        // Retain specific error codes if they are HttpsError
        if (error.code && error.details) throw error;
        throw new functions.https.HttpsError('internal', 'Claim process failed');
    }
});
