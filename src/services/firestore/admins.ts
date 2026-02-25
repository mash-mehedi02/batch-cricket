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
    pwd?: string; // Stored for recovery by Super Admin
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

        const adminRef = doc(db, COLLECTIONS.ADMINS, uid);
        const userRef = doc(db, COLLECTIONS.USERS, uid);

        // Update BOTH collections to ensure session role and permission rules stay in sync
        await Promise.all([
            updateDoc(adminRef, {
                role,
                updatedAt: serverTimestamp()
            }),
            updateDoc(userRef, {
                role,
                updatedAt: serverTimestamp()
            })
        ]);
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

    async checkEmailExists(email: string) {
        const normalizedEmail = email.trim().toLowerCase();

        // Check admins collection
        const adminQ = query(collection(db, COLLECTIONS.ADMINS), where('email', '==', normalizedEmail), limit(1));
        const adminSnap = await getDocs(adminQ);
        if (!adminSnap.empty) return { exists: true, type: 'admin' };

        // Check users collection (which includes players)
        const userQ = query(collection(db, COLLECTIONS.USERS), where('email', '==', normalizedEmail), limit(1));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) return { exists: true, type: 'user' };

        return { exists: false };
    },

    async changePassword(email: string, oldPassword: string, newPassword: string) {
        const { initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth, signInWithEmailAndPassword, updatePassword, signOut } = await import('firebase/auth');
        const { default: app } = await import('@/config/firebase');
        const config = (app as any).options;

        const secondaryApp = initializeApp(config, 'SecondaryPassChange');
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // 1. Sign in as the sub-admin
            const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, oldPassword);

            // 2. Update their password
            await updatePassword(userCredential.user, newPassword);

            // 3. Update the Firestore record so Super Admin can see the new one
            const adminRef = doc(db, COLLECTIONS.ADMINS, userCredential.user.uid);
            await updateDoc(adminRef, {
                pwd: newPassword,
                updatedAt: serverTimestamp()
            });

            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);
            return { success: true };
        } catch (error: any) {
            await deleteApp(secondaryApp);
            console.error('[adminService] changePassword failed:', error);
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
                pwd: data.password, // Save for Super Admin reference
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
            throw new Error('This email is already in use. You cannot create a new admin account with an existing user/player/admin email.');
        } catch (error: any) {
            await deleteApp(secondaryApp);
            throw error;
        }
    }
};
