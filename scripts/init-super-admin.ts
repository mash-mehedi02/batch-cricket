import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "sma-cricket-league.firebaseapp.com",
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://sma-cricket-league-default-rtdb.firebaseio.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "sma-cricket-league",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "sma-cricket-league.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "899272110972",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:899272110972:web:62fe0c9bddf2129f7e6af9",
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-W2G5TD37XE",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function initSuperAdmin() {
    const email = 'batchcrick@gmail.com';
    const password = 'SuperPassword123!'; // Temporary password, admin can change it later
    const name = 'BatchCrick Admin';
    const role = 'super_admin';

    try {
        console.log(`Creating user with email: ${email}...`);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        console.log(`User created in Firebase Auth with UID: ${uid}`);

        const adminRef = doc(db, 'admins', uid);
        await setDoc(adminRef, {
            uid,
            name,
            email,
            role,
            managedSchools: [],
            isActive: true,
            organizationName: 'BatchCrick',
            pwd: password,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log(`Admin document created in 'admins' collection.`);

        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, {
            uid,
            email,
            role,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });
        console.log(`User document created in 'users' collection.`);

        console.log('\n--- SUCCESS ---');
        console.log('Super Admin initialized successfully!');
        console.log(`Email: ${email}`);
        console.log(`Temporary Password: ${password}`);
        console.log('You can now log in using these credentials.');

    } catch (error: any) {
        console.error('Failed to initialize Super Admin:', error.message);
        if (error.code === 'auth/email-already-in-use') {
            console.log('The account already exists in Firebase Auth. You may just need to reset the password or ensure the Firestore documents are present.');
        }
    }
}

initSuperAdmin();
