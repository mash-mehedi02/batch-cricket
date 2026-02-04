import {
    collection,
    doc,
    getDocs,
    updateDoc,
    serverTimestamp,
    setDoc,
    deleteDoc,
    query,
    where,
    limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from './collections';

export interface AdminUser {
    uid: string;
    name: string;
    email: string;
    role: 'admin' | 'super_admin';
    organizationName: string;
    isActive: boolean;
    createdAt: any;
    lastLogin?: any;
}

export const adminService = {
    async getAll() {
        const snap = await getDocs(collection(db, COLLECTIONS.ADMINS));
        return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AdminUser[];
    },

    async updateStatus(uid: string, isActive: boolean) {
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await updateDoc(ref, {
            isActive,
            updatedAt: serverTimestamp()
        });
    },

    async updateRole(uid: string, role: 'admin' | 'super_admin') {
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await updateDoc(ref, {
            role,
            updatedAt: serverTimestamp()
        });
    },

    async delete(uid: string) {
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await deleteDoc(ref);
    },

    // Account Creation
    async createAdminAccount(data: { name: string; email: string; password: string; role: 'admin' | 'super_admin' }) {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

        // We must fetch the config to create a secondary app
        // This is necessary because createUserWithEmailAndPassword on the main app
        // would log out the CURRENT super admin.
        const { default: app } = await import('@/config/firebase');
        const config = (app as any).options;

        const secondaryApp = initializeApp(config, 'SecondaryRegistration');
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const normalizedEmail = data.email.trim().toLowerCase();

            // 1. Create the user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, data.password);
            const uid = userCredential.user.uid;

            // 2. Create the admin document in Firestore (using the PRIMARY app's DB)
            const ref = doc(db, COLLECTIONS.ADMINS, uid);
            await setDoc(ref, {
                uid,
                name: data.name.trim(),
                email: normalizedEmail,
                role: data.role,
                isActive: true,
                organizationName: 'BatchCrick',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 3. Create the user document (for consistency)
            const userRef = doc(db, COLLECTIONS.USERS, uid);
            await setDoc(userRef, {
                uid,
                email: normalizedEmail,
                role: data.role,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });

            // 4. Clean up: Sign out from secondary and destroy it
            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);

            return { success: true, uid };
        } catch (error: any) {
            await deleteApp(secondaryApp);

            // SECURITY/UX IMPROVEMENT: If email exists, find the UID and promote them
            if (error.code === 'auth/email-already-in-use') {
                console.log('[adminService] Email exists. Attempting to locate UID and promote to admin...');

                try {
                    const normalizedEmail = data.email.trim().toLowerCase();
                    const usersRef = collection(db, COLLECTIONS.USERS);
                    const q = query(usersRef, where('email', '==', normalizedEmail), limit(1));
                    const querySnap = await getDocs(q);

                    if (!querySnap.empty) {
                        const existingUserDoc = querySnap.docs[0];
                        const uid = existingUserDoc.id;

                        // Promote to admin in Firestore
                        const adminRef = doc(db, COLLECTIONS.ADMINS, uid);
                        await setDoc(adminRef, {
                            uid,
                            name: data.name.trim() || existingUserDoc.data().displayName || 'Existing User',
                            email: normalizedEmail,
                            role: data.role,
                            isActive: true,
                            organizationName: 'BatchCrick',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        }, { merge: true });

                        // Update role in users collection too
                        await updateDoc(existingUserDoc.ref, {
                            role: data.role,
                            updatedAt: serverTimestamp()
                        });

                        return { success: true, uid, promoted: true };
                    }
                } catch (promotionError) {
                    console.error('[adminService] Promotion fallback failed:', promotionError);
                }
            }

            console.error('[adminService] createAdminAccount failed:', error);
            throw error;
        }
    }
};
