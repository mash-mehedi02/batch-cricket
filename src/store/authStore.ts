/**
 * Auth Store (Zustand)
 * Manages user authentication state and interactions with Firebase Auth/Firestore.
 */

import { create } from 'zustand'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  setPersistence,
  sendPasswordResetEmail,
  browserLocalPersistence
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { User } from '@/types'
import toast from 'react-hot-toast'

// Role-based access is controlled via Firestore 'admins' collection.

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, profileData: any) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  googleLogin: () => Promise<void>
  processLogin: (user: any) => Promise<void>
  updatePlayerProfile: (uid: string, data: any) => Promise<void>
  logout: () => Promise<void>
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  // Legacy Login
  login: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await get().processLogin(userCredential.user);
    } catch (error: any) {
      set({ loading: false });
      throw error;
    }
  },

  // Legacy Signup
  signup: async (email: string, password: string, profileData: any) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: profileData.name });

      const userRef = doc(db, 'users', userCredential.user.uid);

      const newUser: any = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: profileData.name,
        role: 'viewer',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        playerProfile: {
          ...profileData,
          isRegisteredPlayer: true
        }
      };

      await setDoc(userRef, newUser);
      // Removed redundant updatePlayerProfile call here as setDoc handles it.

      set({
        user: newUser,
        loading: false
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  resetPassword: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  googleLogin: async () => {
    try {
      console.log("[AuthStore] Initiating Google Login...");
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();

      // Use Popup for Web as it handles session state better on some browsers (especially local dev)
      console.log("[AuthStore] Attempting Popup Login...");
      const result = await signInWithPopup(auth, provider);

      if (result && result.user) {
        console.log("[AuthStore] Popup Login Success:", result.user.email);
        await get().processLogin(result.user);
      }
    } catch (error: any) {
      console.error('[AuthStore] Google Login Error:', error);

      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        console.log("[AuthStore] Popup blocked/closed. Falling back to Redirect...");
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
        } catch (redirectError: any) {
          console.error("[AuthStore] Redirect Fallback Error:", redirectError);
          toast.error(`Login Failed: ${redirectError.message}`);
        }
      } else {
        toast.error(`Login Failed: ${error.message}`);
        throw error;
      }
    }
  },

  // Centralized Login Processing
  processLogin: async (user: any) => {
    console.log("[AuthStore] Processing Login for:", user.email);
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      let userRole: any = 'viewer';
      if (userSnap.exists()) {
        const storedRole = userSnap.data().role;
        if (storedRole === 'admin' || storedRole === 'super_admin' || storedRole === 'player') {
          userRole = storedRole;
        } else {
          userRole = 'viewer';
        }
      }

      let userData: any = {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        role: userRole,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };

      // Auto-Link Player Profile if email matches a registered player
      if (user.email) {
        try {
          const emailLower = user.email.toLowerCase().trim();
          const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
          const secretsSnap = await getDocs(q);

          if (!secretsSnap.empty) {
            const playerId = secretsSnap.docs[0].id;
            console.log("[AuthStore] Auto-linking: Matching player found for", emailLower, "ID:", playerId);

            const playerRef = doc(db, 'players', playerId);
            const playerSnap = await getDoc(playerRef);

            if (playerSnap.exists()) {
              const playerData = playerSnap.data();
              // Auto-claim if not already claimed, or if claimed by a different UID but email matches
              if (!playerData.claimed || playerData.ownerUid !== user.uid) {
                await updateDoc(playerRef, {
                  claimed: true,
                  ownerUid: user.uid,
                  lastVerifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log("[AuthStore] Player profile auto-linked successfully in Players collection.");
                toast.success('Player profile auto-linked!', { icon: '🔗' });
              }
              // Mark user as registered player in the session
              userData.isRegisteredPlayer = true;
              userData.playerId = playerId; // Link to the specific player doc
              userData.autoFillProfile = playerData;

              // If they are not an admin, give them the 'player' role instead of 'viewer'
              if (userRole === 'viewer') {
                userRole = 'player';
                userData.role = 'player';
                console.log("[AuthStore] Role upgraded to 'player' for auto-linked user.");
              }
            }
          }
        } catch (linkErr) {
          console.warn("[AuthStore] Auto-linking failed:", linkErr);
        }
      }

      if (userSnap.exists()) {
        const existingData: any = userSnap.data();
        console.log("[AuthStore] Profile found. Maintaining existing profile data.");

        userData = {
          ...existingData,
          uid: user.uid,
          email: existingData.email || user.email || null,
          // Prioritize official player name over Google name/existing name
          displayName: (userData.isRegisteredPlayer ? userData.autoFillProfile?.name : null) || existingData.displayName || user.displayName || null,
          photoURL: (userData.isRegisteredPlayer ? userData.autoFillProfile?.photoUrl : null) || existingData.photoURL || user.photoURL || null,
          isRegisteredPlayer: userData.isRegisteredPlayer || existingData.isRegisteredPlayer || false,
          playerId: userData.playerId || existingData.playerId || null,
          autoFillProfile: userData.autoFillProfile || null, // data from matched player doc
          lastLogin: serverTimestamp(),
          role: userRole,
        };

        // If newly linked or missing playerProfile on user doc, sync it now
        if (userData.isRegisteredPlayer && userData.autoFillProfile && (!existingData.playerProfile || !existingData.playerId)) {
          userData.playerProfile = {
            name: userData.autoFillProfile.name || userData.displayName,
            role: userData.autoFillProfile.role || 'batsman',
            battingStyle: userData.autoFillProfile.battingStyle || 'right-handed',
            bowlingStyle: userData.autoFillProfile.bowlingStyle || 'right-arm-medium',
            photoUrl: userData.autoFillProfile.photoUrl || (userData as any).photoURL,
            isRegisteredPlayer: true,
            setupAt: serverTimestamp()
          };
          userData.playerId = userData.playerId || userData.autoFillProfile.id;
        }

        const updates: any = {
          lastLogin: serverTimestamp(),
          photoURL: userData.photoURL || null,
          displayName: userData.displayName || null,
          role: userRole
        };

        if (userData.isRegisteredPlayer) {
          updates.isRegisteredPlayer = true;
          if (userData.playerId) updates.playerId = userData.playerId;
          if (userData.playerProfile) updates.playerProfile = userData.playerProfile;
        }

        updateDoc(userRef, updates).catch(e => console.error("[AuthStore] Login Update Warn:", e));

      } else {
        console.log("[AuthStore] New account. Role:", userRole);

        // Finalize userData for new accounts
        userData.displayName = userData.autoFillProfile?.name || userData.displayName;
        userData.photoURL = userData.autoFillProfile?.photoUrl || userData.photoURL;

        if (userData.isRegisteredPlayer && userData.autoFillProfile) {
          userData.playerProfile = {
            name: userData.autoFillProfile.name,
            role: userData.autoFillProfile.role,
            battingStyle: userData.autoFillProfile.battingStyle,
            bowlingStyle: userData.autoFillProfile.bowlingStyle,
            photoUrl: userData.autoFillProfile.photoUrl,
            isRegisteredPlayer: true,
            setupAt: serverTimestamp()
          };
        }

        await setDoc(userRef, userData);
      }

      set({
        user: userData as User,
        loading: false,
      });
      console.log("[AuthStore] Login Process Complete. Role:", userData.role);

    } catch (error: any) {
      console.error("[AuthStore] Process Login Error:", error);
      toast.error(`Login Process Error: ${error.message}`);
      set({ loading: false });
      throw error;
    }
  },

  updatePlayerProfile: async (uid: string, data: any) => {
    try {
      const userRef = doc(db, 'users', uid);

      const profileUpdates: any = {
        playerProfile: {
          ...data,
          isRegisteredPlayer: true,
          setupAt: serverTimestamp()
        },
        isRegisteredPlayer: true,
        displayName: data.displayName || data.name || null,
        photoURL: data.photoUrl || data.photo || null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, profileUpdates);

      // CRITICAL: If they are a registered player, sync data to the public 'players' collection too
      const currentUser = get().user;
      if (currentUser?.playerId) {
        console.log("[AuthStore] Syncing public player profile for:", currentUser.playerId);
        const playerRef = doc(db, 'players', currentUser.playerId);
        await updateDoc(playerRef, {
          name: data.displayName || data.name || currentUser.displayName,
          photoUrl: data.photoUrl || data.photo || currentUser.photoURL,
          role: data.role,
          battingStyle: data.battingStyle,
          bowlingStyle: data.bowlingStyle,
          address: data.address,
          school: data.school,
          dateOfBirth: data.dateOfBirth,
          updatedAt: serverTimestamp()
        }).catch(err => console.warn("[AuthStore] Public player sync failed:", err));
      }

      // Update local state
      set((state) => ({
        user: state.user ? {
          ...state.user,
          displayName: profileUpdates.displayName || state.user.displayName,
          photoURL: profileUpdates.photoURL || state.user.photoURL,
          playerProfile: profileUpdates.playerProfile
        } : null
      }));

      toast.success("Profile Setup Complete!");
    } catch (error) {
      console.error('Update Profile error:', error);
      toast.error("Failed to save profile");
      throw error;
    }
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null })
  },

  initialize: () => {
    console.log("[AuthStore] Initializing Auth System...");

    // Force persistence once during init to be safe
    setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence error:", e));

    // Check for Redirect Result (Mobile/Fallback)
    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        console.log("[AuthStore] Redirect Result found:", result.user.email);
        toast.success("Redirect Login Successful!", { id: 'login-success' });
        await get().processLogin(result.user);
      }
    }).catch(e => {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error("[AuthStore] Redirect Result Error:", e);
        // Don't toast for "no result found" which is common on refresh
        if (!e.message.includes('redirect-result')) {
          toast.error(`Redirect Login Error: ${e.message}`);
        }
      }
    });

    onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        console.log("[AuthStore] AuthStateChanged: User Logged In", firebaseUser.email);
        set({ loading: true })
        try {
          const userRef = doc(db, 'users', firebaseUser.uid)
          const docSnap = await getDoc(userRef)

          if (docSnap.exists()) {
            const data = docSnap.data() as User
            console.log("[AuthStore] Profile Loaded. Role:", data.role);
            set({ user: data, loading: false })
          } else {
            console.log("[AuthStore] Auth session exists but no Firestore profile. Processing...");
            await get().processLogin(firebaseUser);
          }
        } catch (error: any) {
          console.error('[AuthStore] AuthState Profile Fetch Error:', error)
          toast.error(`Profile Fetch Failed: ${error.message}`);
          set({ user: null, loading: false })
        }
      } else {
        console.log("[AuthStore] AuthStateChanged: Clear (No Session)");
        set({ user: null, loading: false })
      }
    })
  }
}))
