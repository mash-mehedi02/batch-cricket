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

import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
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
      const normalizedEmail = email.trim().toLowerCase();
      console.log("[AuthStore] Attempting login for:", normalizedEmail);
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      return await get().processLogin(userCredential.user);
    } catch (error: any) {
      console.error("[AuthStore] Login Error:", error.code, error.message);
      set({ loading: false });
      throw error;
    }
  },

  // Legacy Signup
  signup: async (email: string, password: string, profileData: any) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await updateProfile(userCredential.user, { displayName: profileData.name });

      const userRef = doc(db, 'users', userCredential.user.uid);

      const newUser: any = {
        uid: userCredential.user.uid,
        email: normalizedEmail,
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
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
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
      provider.setCustomParameters({ prompt: 'select_account' });

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
        // Keep special roles, otherwise default to viewer for identity check
        if (storedRole === 'admin' || storedRole === 'super_admin') {
          userRole = storedRole;
        }
      }

      const isNewUser = !userSnap.exists();
      let emailMatchPlayer: any = null;
      let emailMatchPlayerId: string | null = null;

      // --- STEP 1: IDENTITY LOOKUP (STRICT EMAIL MAPPING) ---
      if (user.email) {
        const emailLower = user.email.toLowerCase().trim();
        console.log("[AuthStore] Querying player_secrets for:", emailLower);
        const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
        const secretsSnap = await getDocs(q);

        if (!secretsSnap.empty) {
          emailMatchPlayerId = secretsSnap.docs[0].id;
          const playerSnap = await getDoc(doc(db, 'players', emailMatchPlayerId));

          if (playerSnap.exists()) {
            const playerData = playerSnap.data();

            // SECURITY RULE: Ensure this UID is either the owner or the profile is unclaimed
            if (!playerData.ownerUid || playerData.ownerUid === user.uid) {
              emailMatchPlayer = playerData;
              console.log("[AuthStore] Secure Match Found:", emailMatchPlayerId);

              // Claim it if unclaimed
              if (!playerData.ownerUid) {
                console.log("[AuthStore] Attempting to claim player profile:", emailMatchPlayerId);
                await updateDoc(doc(db, 'players', emailMatchPlayerId), {
                  claimed: true,
                  ownerUid: user.uid,
                  lastVerifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log("[AuthStore] Profile claim successful.");
                toast.success('Player profile linked!', { icon: '🔗' });
              }

              if (userRole === 'viewer') userRole = 'player';
            } else {
              console.warn("[AuthStore] SECURITY: Player is owned by another UID. Skipping link.");
            }
          }
        }
      }

      // --- STEP 1.5: ADMIN DISCOVERY (BY EMAIL) ---
      if (user.email) {
        const emailLower = user.email.toLowerCase().trim();
        console.log("[AuthStore] Checking for Admin rights for:", emailLower);
        const adminQ = query(collection(db, 'admins'), where('email', '==', emailLower), limit(1));
        const adminSnap = await getDocs(adminQ);

        if (!adminSnap.empty) {
          const adminData = adminSnap.docs[0].data();
          if (adminData.isActive) {
            console.log("[AuthStore] Admin email match found! Granting privileges.");
            userRole = adminData.role || 'admin';

            // If the UID in the admin record is different, we need to sync it
            if (adminData.uid !== user.uid) {
              console.log("[AuthStore] Syncing Admin UID from", adminData.uid, "to", user.uid);
              // We create/update the record with the current UID
              await setDoc(doc(db, 'admins', user.uid), {
                ...adminData,
                uid: user.uid,
                updatedAt: serverTimestamp()
              });
              // Note: We don't delete the old one here to be safe, 
              // but the new one will be used for rules via request.auth.uid
            }
          }
        }
      }

      // --- STEP 2: CONSTRUCT FINAL USER DATA ---
      // We start with minimum required fields
      let finalUserData: any = {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        role: userRole,
        lastLogin: serverTimestamp(),
      };

      if (isNewUser) {
        finalUserData.createdAt = serverTimestamp();
      } else {
        // Merge with existing data but we will selectively overwrite identity fields
        finalUserData = { ...userSnap.data(), ...finalUserData };
      }

      // --- STEP 3: FORCE IDENTITY OVERWRITE ---
      // If we have a valid email match, NOTHING in the old record matters.
      // We overwrite everything related to player identity.
      if (emailMatchPlayer) {
        console.log("[AuthStore] Overwriting profile with identity from:", emailMatchPlayerId);
        finalUserData.isRegisteredPlayer = true;
        finalUserData.playerId = emailMatchPlayerId;
        finalUserData.linkedPlayerId = emailMatchPlayerId;
        finalUserData.displayName = emailMatchPlayer.name || finalUserData.displayName;
        finalUserData.photoURL = emailMatchPlayer.photoUrl || finalUserData.photoURL;
        finalUserData.role = userRole;

        // Sync playerProfile object
        finalUserData.playerProfile = {
          ...(finalUserData.playerProfile || {}),
          name: emailMatchPlayer.name,
          role: emailMatchPlayer.role || 'batsman',
          isRegisteredPlayer: true,
          photoUrl: emailMatchPlayer.photoUrl,
          squadId: emailMatchPlayer.squadId,
          battingStyle: emailMatchPlayer.battingStyle,
          bowlingStyle: emailMatchPlayer.bowlingStyle
        };
      } else {
        // NO MATCH: Revoke all player permissions and clear IDs
        console.log("[AuthStore] No email match. Cleaning up player identity.");
        finalUserData.isRegisteredPlayer = false;
        finalUserData.playerId = null;
        finalUserData.linkedPlayerId = null;
        finalUserData.playerProfile = null;
        if (finalUserData.role === 'player') finalUserData.role = 'viewer';
      }

      // --- STEP 4: SAVE TO FIRESTORE ---
      console.log("[AuthStore] Finalizing User Document update...");
      if (isNewUser) {
        await setDoc(userRef, finalUserData);
        console.log("[AuthStore] User document created.");
      } else {
        await updateDoc(userRef, finalUserData);
        console.log("[AuthStore] User document updated.");
      }

      set({
        user: finalUserData as User,
        loading: false,
      });

      console.log("[AuthStore] Identity Processing Complete. Final Role:", finalUserData.role);
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
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        await GoogleAuth.signOut().catch(e => console.warn("GoogleAuth native signout failed:", e));
      }
    } catch (e) {
      console.warn("Logout native cleaning failed:", e);
    }
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
            const emailLower = firebaseUser.email?.toLowerCase().trim();
            const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
            const secretsSnap = await getDocs(q);
            const verifiedPlayerId = !secretsSnap.empty ? secretsSnap.docs[0].id : null;

            // IDENTITY CHECK: If admin changed the email or unlinked the player
            // we force a LOGOUT to ensure security and prevent ghost access.
            if (data.isRegisteredPlayer && data.playerId !== verifiedPlayerId) {
              console.warn("[AuthStore] Identity mismatch/revocation detected. Force Logout.");
              toast.error("Your profile access has been updated. Please login again.", { id: 'auth-revoked' });
              await get().logout();
              return;
            }

            set({ user: data, loading: false });
          } else {
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
