import {
    collection,
    doc,
    getDoc,
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
    managedSchools: string[]; // List of school names this admin can manage
    organizationName: string;
    isActive: boolean;
    createdAt: any;
    lastLogin?: any;
    updatedAt?: any;
}

export const SUPER_ADMIN_EMAIL = 'batchcrick@gmail.com';

export const isOriginalSuperAdmin = (email: string) => {
    return email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
};

export const adminService = {
    async getAll() {
        const snap = await getDocs(collection(db, COLLECTIONS.ADMINS));
        return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AdminUser[];
    },

    async getById(uid: string) {
        const snap = await getDoc(doc(db, COLLECTIONS.ADMINS, uid));
        if (!snap.exists()) return null;
        return { uid: snap.id, ...snap.data() } as AdminUser;
    },

    async updateStatus(uid: string, isActive: boolean) {
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await updateDoc(ref, {
            isActive,
            updatedAt: serverTimestamp()
        });
    },

    async updateRole(uid: string, role: 'admin' | 'super_admin', adminEmail?: string) {
        // Prevent demoting the original super admin
        if (adminEmail && isOriginalSuperAdmin(adminEmail)) {
            throw new Error('The original Super Admin cannot be demoted.');
        }

        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await updateDoc(ref, {
            role,
            updatedAt: serverTimestamp()
        });
    },

    async updateManagedSchools(uid: string, managedSchools: string[]) {
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await updateDoc(ref, {
            managedSchools,
            updatedAt: serverTimestamp()
        });
    },

    async delete(uid: string, adminEmail?: string) {
        // Prevent deleting the original super admin
        if (adminEmail && isOriginalSuperAdmin(adminEmail)) {
            throw new Error('The original Super Admin cannot be deleted.');
        }
        const ref = doc(db, COLLECTIONS.ADMINS, uid);
        await deleteDoc(ref);
    },

    async resetAdminPassword(email: string, newPassword: string) {
        // This requires a secondary app to perform password update on a different user
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, signInWithEmailAndPassword, updatePassword, signOut } = await import('firebase/auth');
        const { default: app } = await import('@/config/firebase');
        const config = (app as any).options;

        const secondaryApp = initializeApp(config, 'SecondaryReset');
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // Note: This requires the super admin to know the current password of the sub-admin OR 
            // the system to have a way to force reset. 
            // In Firebase Client SDK, you can't reset another user's password without their credentials.
            // Admin SDK (Node.js) is required for true "admin reset".
            // Since this is a client-side app, we will suggest the "Send Password Reset Email" flow
            // or if the user insists on setting it manually, they might need a custom backend function.
            // However, the user asked for "reset kore new pass set kore dite parbe".
            // I will implement a Cloud Function call for this if possible, or use the email flow.
            // For now, let's use the password reset email as the secure method, 
            // UNLESS I implement a cloud function.

            // Re-reading: "reset kore new pass set kore dite parbe new password"
            // I'll assume we might need a cloud function for this.
            return { success: false, message: 'Cloud Function required for manual password override.' };
        } catch (error) {
            await deleteApp(secondaryApp);
            throw error;
        }
    },

    // Account Creation
    async createAdminAccount(data: { name: string; email: string; password: string; role: 'admin' | 'super_admin' }) {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

        const { default: app } = await import('@/config/firebase');
        const config = (app as any).options;

        const secondaryApp = initializeApp(config, 'SecondaryRegistration');
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const normalizedEmail = data.email.trim().toLowerCase();

            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, data.password);
            const uid = userCredential.user.uid;

            const adminRef = doc(db, COLLECTIONS.ADMINS, uid);
            await setDoc(adminRef, {
                uid,
                name: data.name.trim(),
                email: normalizedEmail,
                role: data.role,
                managedSchools: [],
                isActive: true,
                organizationName: 'BatchCrick',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const userRef = doc(db, COLLECTIONS.USERS, uid);
            await setDoc(userRef, {
                uid,
                email: normalizedEmail,
                role: data.role,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });

            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);

            return { success: true, uid };
        } catch (error: any) {
            await deleteApp(secondaryApp);
            if (error.code === 'auth/email-already-in-use') {
                try {
                    const normalizedEmail = data.email.trim().toLowerCase();
                    const usersRef = collection(db, COLLECTIONS.USERS);
                    const q = query(usersRef, where('email', '==', normalizedEmail), limit(1));
                    const querySnap = await getDocs(q);

                    if (!querySnap.empty) {
                        const existingUserDoc = querySnap.docs[0];
                        const uid = existingUserDoc.id;

                        const adminRef = doc(db, COLLECTIONS.ADMINS, uid);
                        await setDoc(adminRef, {
                            uid,
                            name: data.name.trim() || existingUserDoc.data().displayName || 'Existing User',
                            email: normalizedEmail,
                            role: data.role,
                            managedSchools: [],
                            isActive: true,
                            organizationName: 'BatchCrick',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        }, { merge: true });

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
            throw error;
        }
    }
};
