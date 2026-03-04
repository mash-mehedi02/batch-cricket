
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc",
    authDomain: "sma-cricket-league.firebaseapp.com",
    projectId: "sma-cricket-league",
    storageBucket: "sma-cricket-league.firebasestorage.app",
    messagingSenderId: "899272110972",
    appId: "1:899272110972:web:62fe0c9bddf2129f7e6af9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
    console.log("--- Players Collection ---");
    const playersSnap = await getDocs(collection(db, 'players'));
    for (const d of playersSnap.docs.slice(0, 5)) {
        const data = d.data();
        console.log(`Player ID: ${d.id}, Name: ${data.name}, Email: ${data.email}, Owner: ${data.ownerUid}`);

        // Check secret
        const secretRef = doc(db, 'player_secrets', d.id);
        const secretSnap = await getDoc(secretRef);
        if (secretSnap.exists()) {
            console.log(`  - Secret found: ${secretSnap.data().email}`);
        } else {
            console.log(`  - NO SECRET FOUND`);
        }
    }

    console.log("\n--- Users Collection ---");
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs.slice(0, 5)) {
        const data = d.data();
        console.log(`User UID: ${d.id}, Email: ${data.email}, Role: ${data.role}, PlayerID: ${data.playerId}`);
    }
}

checkData().catch(console.error);
