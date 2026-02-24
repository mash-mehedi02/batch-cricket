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
  sendPasswordResetEmail,
  browserLocalPersistence,
  setPersistence,
  getRedirectResult
} from 'firebase/auth'

import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { User } from '@/types'
import toast from 'react-hot-toast'

// Role-based access is controlled via Firestore 'admins' collection.

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, profileData: any) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  googleLogin: () => Promise<boolean>
  processLogin: (user: any) => Promise<boolean>
  updatePlayerProfile: (uid: string, data: any) => Promise<void>
  logout: () => Promise<void>
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  // Legacy Login
  login: async (email: string, password: string): Promise<boolean> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return await get().processLogin(userCredential.user);
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

      const { Capacitor } = await import('@capacitor/core');

      // --- NATIVE ANDROID/IOS PATH ---
      if (Capacitor.isNativePlatform()) {
        console.log("[AuthStore] Native Android detected. Using Capacitor Google Auth.");
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');

        try {
          // Explicitly call signIn (Initialization is handled in main.tsx)
          const result = await GoogleAuth.signIn();

          if (!result || !result.authentication.idToken) {
            console.warn("[AuthStore] Native Sign-In: No ID Token received.");
            return false;
          }

          const credential = GoogleAuthProvider.credential(result.authentication.idToken);
          const userCredential = await signInWithCredential(auth, credential);

          console.log("[AuthStore] Native Login Success:", userCredential.user.email);
          return await get().processLogin(userCredential.user);

        } catch (nativeError: any) {
          // Catch cancellations specifically (12501 or message)
          const isCancel =
            nativeError.message?.toLowerCase().includes('cancel') ||
            nativeError.code === 'CANCELLED' ||
            nativeError.code === '12501';

          if (isCancel) {
            console.log("[AuthStore] Native Login Cancelled.");
          } else {
            console.error('[AuthStore] Native Login Error:', nativeError);
            toast.error(`Login Failed: ${nativeError.message || 'Check your connection'}`);
          }
          return false;
        }
      }

      // --- WEB PATH ---
      console.log("[AuthStore] Web detected. Using Popup/Redirect.");
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect, setPersistence, browserLocalPersistence } = await import('firebase/auth');

      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();

      try {
        const result = await signInWithPopup(auth, provider);
        if (result && result.user) {
          return await get().processLogin(result.user);
        }
      } catch (popupError: any) {
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          console.log("[AuthStore] Web Popup blocked. Falling back to Redirect...");
          await signInWithRedirect(auth, provider);
          return false;
        }
        console.error('[AuthStore] Web Login Error:', popupError);
        toast.error(`Login Failed: ${popupError.message}`);
      }
      return false;
    } catch (error: any) {
      console.error('[AuthStore] Fatal Google Login Error:', error);
      toast.error("An unexpected error occurred.");
      return false;
    }
  },

  // Centralized Login Processing - Returns true if it's a new account
  processLogin: async (user: any): Promise<boolean> => {
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

      const isNewUser = !userSnap.exists();
      let userData: any = {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        role: userRole,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };

      // --- SECURE AUTO-LINK & IDENTITY SYNC ---
      // Enforces strict ownership rules:
      // 1. Email match + ownerUid is null → allow claim
      // 2. Email match + ownerUid === current UID → allow access
      // 3. Email match + ownerUid belongs to someone else → DENY (no stealing)
      // 4. No email match → viewer only (no player link)
      // 5. Stale link revocation if email no longer matches
      if (user.email) {
        try {
          const emailLower = user.email.toLowerCase().trim();

          // 1. Check if this email is registered in player_secrets
          const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
          const secretsSnap = await getDocs(q);

          if (!secretsSnap.empty) {
            const playerId = secretsSnap.docs[0].id;
            console.log("[AuthStore] Identity Match Found:", emailLower, "-> Player:", playerId);

            const playerRef = doc(db, 'players', playerId);
            const playerSnap = await getDoc(playerRef);

            if (playerSnap.exists()) {
              const playerData = playerSnap.data();

              // RULE 3: If ownerUid exists AND belongs to someone else → DENY
              if (playerData.ownerUid && playerData.ownerUid !== user.uid) {
                console.warn("[AuthStore] SECURITY: Player", playerId, "is owned by", playerData.ownerUid, "(not this user:", user.uid, "). Access DENIED.");
                // Do NOT link. Treat as viewer.
              }
              // RULE 2: Already claimed by this user → allow access
              else if (playerData.claimed && playerData.ownerUid === user.uid) {
                console.log("[AuthStore] Already claimed by this user. Access granted.");
                userData.isRegisteredPlayer = true;
                userData.playerId = playerId;
                userData.linkedPlayerId = playerId;
                userData.autoFillProfile = playerData;

                if (userRole === 'viewer') {
                  userRole = 'player';
                  userData.role = 'player';
                }
              }
              // RULE 1: Not claimed yet (ownerUid is null) → claim it
              else if (!playerData.ownerUid) {
                console.log("[AuthStore] Unclaimed player found. Claiming for user:", user.uid);
                await updateDoc(playerRef, {
                  claimed: true,
                  ownerUid: user.uid,
                  lastVerifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                toast.success('Player profile linked!', { icon: '🔗' });

                userData.isRegisteredPlayer = true;
                userData.playerId = playerId;
                userData.linkedPlayerId = playerId;
                userData.autoFillProfile = playerData;

                if (userRole === 'viewer') {
                  userRole = 'player';
                  userData.role = 'player';
                }
              }
            }
          } else {
            // RULE 4 & 5: No email match → check for stale links to revoke
            if (userSnap.exists() && userSnap.data().isRegisteredPlayer) {
              const linkedPid = userSnap.data().linkedPlayerId || userSnap.data().playerId;
              if (linkedPid) {
                // Verify the linked player still has this user's email
                const linkedSecretRef = doc(db, 'player_secrets', linkedPid);
                const linkedSecretSnap = await getDoc(linkedSecretRef);

                const linkedEmail = linkedSecretSnap.exists() ? linkedSecretSnap.data()?.email?.toLowerCase() : null;

                if (linkedEmail !== emailLower) {
                  console.log("[AuthStore] REVOCATION: Email changed by admin. Revoking player access.");
                  userData.isRegisteredPlayer = false;
                  userData.playerId = null;
                  userData.linkedPlayerId = null;
                  userData.playerProfile = null;
                  if (userRole === 'player') {
                    userRole = 'viewer';
                    userData.role = 'viewer';
                  }
                } else {
                  // Email still matches, keep access
                  userData.isRegisteredPlayer = true;
                  userData.playerId = linkedPid;
                  userData.linkedPlayerId = linkedPid;
                }
              }
            }
          }
        } catch (linkErr) {
          console.warn("[AuthStore] Identity sync failed:", linkErr);
        }
      }

      if (!isNewUser) {
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
          linkedPlayerId: userData.linkedPlayerId || existingData.linkedPlayerId || userData.playerId || existingData.playerId || null,
          autoFillProfile: userData.autoFillProfile || null, // data from matched player doc
          lastLogin: serverTimestamp(),
          role: userRole,
        };

        // If newly linked or missing playerProfile on user doc, sync it now
        if (userData.isRegisteredPlayer && userData.autoFillProfile && (!existingData.playerProfile || !existingData.playerId || !existingData.playerProfile.isRegisteredPlayer)) {
          userData.playerProfile = {
            ...(existingData.playerProfile || {}),
            name: userData.autoFillProfile.name || userData.displayName,
            role: userData.autoFillProfile.role || 'batsman',
            battingStyle: userData.autoFillProfile.battingStyle || 'right-handed',
            bowlingStyle: userData.autoFillProfile.bowlingStyle || 'right-arm-medium',
            photoUrl: userData.autoFillProfile.photoUrl || (userData as any).photoURL,
            isRegisteredPlayer: true,
            setupAt: serverTimestamp()
          };
          userData.playerId = userData.playerId || userData.autoFillProfile.id;
          userData.linkedPlayerId = userData.playerId;
        }

        const updates: any = {
          lastLogin: serverTimestamp(),
          photoURL: userData.photoURL || null,
          displayName: userData.displayName || null,
          role: userRole,
          isRegisteredPlayer: userData.isRegisteredPlayer || false,
          playerId: userData.playerId || null,
          linkedPlayerId: userData.linkedPlayerId || null,
          playerProfile: userData.playerProfile || null
        };

        // FORCE SYNC: If the player ID has changed (admin reassigned email), 
        // we MUST overwrite the name and profile to avoid showing the old person's data.
        if (userData.playerId !== existingData.playerId) {
          console.log("[AuthStore] Player ID Change detected. Forcing metadata sync.");
          updates.displayName = userData.autoFillProfile?.name || updates.displayName;
          updates.photoURL = userData.autoFillProfile?.photoUrl || updates.photoURL;
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

        // Also ensure linkedPlayerId is mirrored for new accounts
        if (userData.playerId) {
          userData.linkedPlayerId = userData.playerId;
        }

        await setDoc(userRef, userData);
      }

      set({
        user: userData as User,
        loading: false,
      });
      console.log("[AuthStore] Login Process Complete. Role:", userData.role);

      return isNewUser;

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
    setPersistence(auth, browserLocalPersistence).catch((e: any) => console.error("Persistence error:", e));

    let userUnsubscribe: (() => void) | null = null;

    // Check for Redirect Result (Mobile/Fallback)
    getRedirectResult(auth).then(async (result: any) => {
      if (result && result.user) {
        console.log("[AuthStore] Redirect Result found:", result.user.email);
        toast.success("Redirect Login Successful!", { id: 'login-success' });
        const isNew = await get().processLogin(result.user);
        if (isNew) {
          window.location.href = '/edit-profile';
        }
      }
    }).catch((e: any) => {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error("[AuthStore] Redirect Result Error:", e);
        if (e.message && !e.message.includes('redirect-result')) {
          toast.error(`Redirect Login Error: ${e.message}`);
        }
      }
    });

    onAuthStateChanged(auth, async (firebaseUser: any) => {
      // Clean up previous listener
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        console.log("[AuthStore] AuthStateChanged: User Logged In", firebaseUser.email);
        set({ loading: true });

        // --- REAL-TIME USER DOCUMENT LISTENER ---
        // This ensures INSTANT updates when admin changes email, role, or unlinks profile
        const { onSnapshot } = await import('firebase/firestore');
        const userRef = doc(db, 'users', firebaseUser.uid);

        userUnsubscribe = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as User;
            console.log("[AuthStore] REAL-TIME Update: User Role =", data.role);

            // If user is a player, we always verify identity sync to catch admin changes
            // (e.g. if admin changed the player email associated with this user)
            const emailLower = firebaseUser.email?.toLowerCase().trim();
            const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
            const secretsSnap = await getDocs(q);
            const verifiedPlayerId = !secretsSnap.empty ? secretsSnap.docs[0].id : null;

            // IDENTITY CHECK: If currently linked ID doesn't match current email's secret ID
            if (data.isRegisteredPlayer && data.playerId !== verifiedPlayerId) {
              console.log("[AuthStore] Identity mismatch detected in real-time. Re-syncing...");
              await get().processLogin(firebaseUser);
            } else {
              set({ user: data, loading: false });
            }
          } else {
            // Document doesn't exist yet, process login to create it
            console.log("[AuthStore] No user profile found. Creating...");
            await get().processLogin(firebaseUser);
          }
        }, (err) => {
          console.error("[AuthStore] Snapshot error:", err);
          set({ loading: false });
        });

      } else {
        console.log("[AuthStore] AuthStateChanged: Clear (No Session)");
        set({ user: null, loading: false });
      }
    });
  }

}))
