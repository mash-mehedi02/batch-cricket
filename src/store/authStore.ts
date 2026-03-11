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

import { loginRateLimiter } from '@/utils/rateLimiter'

// Role-based access is controlled via Firestore 'admins' collection.
const activeProcessings = new Map<string, Promise<boolean>>();

/**
 * Fetch IP and basic location info for security logging
 * Disabled on client-side for privacy and performance.
 */
async function fetchConnectivityInfo() {
  return { ip: 'unknown', city: 'unknown', country: 'unknown' };
}


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
  syncSessionMetadata: (user: any) => Promise<void>
  isProcessing: boolean
  isSyncingIdentity: boolean
  hasUpdatedMetadata: boolean
}


export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  isProcessing: false,
  isSyncingIdentity: false,
  hasUpdatedMetadata: false,

  // Legacy Login
  login: async (email: string, password: string): Promise<boolean> => {
    const status = loginRateLimiter.getStatus();
    if (status.isLocked) {
      set({ loading: false });
      const mins = Math.ceil(status.remainingMs / 60000);
      throw { code: 'auth/too-many-requests', message: `Too many attempts. Try again in ${mins} minutes.` };
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      console.log("[AuthStore] Attempting login for:", normalizedEmail);
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      loginRateLimiter.reset();
      return await get().processLogin(userCredential.user);
    } catch (error: any) {
      // Record the failed attempt
      loginRateLimiter.increment();
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
      set({ isProcessing: true });

      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        console.log("[AuthStore] Native Android detected. Using Capacitor Google Auth.");
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');

        try {
          console.log("[AuthStore] Native GoogleAuth.signIn() started...");
          const result = await GoogleAuth.signIn();

          if (!result || !result.authentication.idToken) {
            console.warn("[AuthStore] Native Sign-In: No ID Token received.");
            set({ isProcessing: false });
            return false;
          }

          const credential = GoogleAuthProvider.credential(result.authentication.idToken);
          const userCredential = await signInWithCredential(auth, credential);

          console.log("[AuthStore] Native Login Success:", userCredential.user.email);
          return await get().processLogin(userCredential.user);

        } catch (nativeError: any) {
          set({ isProcessing: false });
          const isCancel =
            nativeError.message?.toLowerCase().includes('cancel') ||
            nativeError.code === 'CANCELLED' ||
            nativeError.code === '12501';

          if (isCancel) {
            console.log("[AuthStore] Native Login Cancelled.");
          } else {
            console.error('[AuthStore] Native Login Error:', nativeError);
            let errMsg = nativeError.message || 'Check your connection';
            if (errMsg.includes('10') || errMsg.includes('DEVELOPER_ERROR')) {
              errMsg = 'Developer Error (10): Ensure SHA-1 fingerprint is added in Firebase Console';
            }
            toast.error(`Login Failed: ${errMsg}`);
          }
          return false;
        }
      }

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
        set({ isProcessing: false });
      } catch (popupError: any) {
        set({ isProcessing: false });
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          console.log("[AuthStore] Web Popup blocked. Falling back to Redirect...");
          await signInWithRedirect(auth, provider);
          return false;
        }
        console.error('[AuthStore] Web Login Error:', popupError);
        toast.error(`Login Failed: ${popupError.message}`);
      }
      set({ isProcessing: false });
      return false;
    } catch (error: any) {
      set({ isProcessing: false });
      console.error('[AuthStore] Fatal Google Login Error:', error);
      toast.error("An unexpected error occurred.");
      return false;
    }
  },

  syncSessionMetadata: async (firebaseUser: any) => {
    if (get().hasUpdatedMetadata || !firebaseUser?.uid) return;
    set({ hasUpdatedMetadata: true });

    try {
      console.log("[AuthStore] Syncing Session Metadata...");
      const connectivity = await fetchConnectivityInfo();
      const metadata: any = {
        lastLogin: serverTimestamp(),
        ip: connectivity.ip,
        location: `${connectivity.city}, ${connectivity.country}`,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: (navigator as any).userAgentData?.platform || navigator.platform,
        }
      };

      await updateDoc(doc(db, 'users', firebaseUser.uid), metadata);
      console.log("[AuthStore] Session Metadata Synced.");
    } catch (err) {
      console.warn("[AuthStore] Session Metadata Sync Failed (likely expected if offline):", err);
    }
  },

  processLogin: async (user: any): Promise<boolean> => {
    const uid = user?.uid;
    if (!uid) return false;

    if (activeProcessings.has(uid)) {
      console.log("[AuthStore] Joining existing processLogin for:", uid);
      return activeProcessings.get(uid)!;
    }

    const processPromise = (async () => {
      set({ isProcessing: true, isSyncingIdentity: true });
      console.log("[AuthStore] processLogin START for:", user.email || uid);

      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const existingData = userSnap.exists() ? userSnap.data() : {};

        let userRole: any = existingData.role || 'guest';
        if (!['admin', 'super_admin', 'player', 'scorer'].includes(userRole)) {
          userRole = 'guest';
        }

        const isNewUser = !userSnap.exists();
        let emailMatchPlayer: any = null;
        let emailMatchPlayerId: string | null = null;
        let isAdmin = false;

        // --- STEP 1: ADMIN DISCOVERY ---
        try {
          if (user.email) {
            const emailLower = user.email.toLowerCase().trim();
            const { SUPER_ADMIN_EMAIL } = await import('@/services/firestore/admins');
            if (emailLower === SUPER_ADMIN_EMAIL.toLowerCase()) {
              userRole = 'super_admin';
              isAdmin = true;
            } else {
              const adminDoc = await getDoc(doc(db, 'admins', uid));
              if (adminDoc.exists() && adminDoc.data().isActive) {
                userRole = adminDoc.data().role || 'admin';
                isAdmin = true;
              } else {
                const adminQ = query(collection(db, 'admins'), where('email', '==', emailLower), limit(1));
                const adminSnap = await getDocs(adminQ);
                if (!adminSnap.empty && adminSnap.docs[0].data().isActive) {
                  const adminData = adminSnap.docs[0].data();
                  userRole = adminData.role || 'admin';
                  isAdmin = true;
                  if (adminSnap.docs[0].id !== uid) {
                    await setDoc(doc(db, 'admins', uid), { ...adminData, uid, updatedAt: serverTimestamp() });
                  }
                }
              }
            }
          }
        } catch (adminErr) {
          console.warn("[AuthStore] Admin discovery skipped (permission issue):", adminErr);
        }

        // --- STEP 2: PLAYER IDENTITY LOOKUP ---
        try {
          if (user.email && !isAdmin) {
            const emailLower = user.email.toLowerCase().trim();
            const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
            const secretsSnap = await getDocs(q);

            if (!secretsSnap.empty) {
              emailMatchPlayerId = secretsSnap.docs[0].id;
              const playerSnap = await getDoc(doc(db, 'players', emailMatchPlayerId));
              if (playerSnap.exists()) {
                const playerData = playerSnap.data();
                if (!playerData.ownerUid || playerData.ownerUid === uid) {
                  emailMatchPlayer = playerData;
                  if (!playerData.ownerUid) {
                    await updateDoc(doc(db, 'players', emailMatchPlayerId), {
                      claimed: true,
                      ownerUid: uid,
                      lastVerifiedAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    });
                    toast.success('Player profile linked!', { icon: '🔗' });
                  }
                  if (userRole === 'guest') userRole = 'player';
                }
              }
            } else {
              const pQ = query(collection(db, 'players'), where('email', '==', emailLower), limit(1));
              const pSnap = await getDocs(pQ);
              if (!pSnap.empty) {
                const pData = pSnap.docs[0].data();
                const pId = pSnap.docs[0].id;
                if (!pData.ownerUid || pData.ownerUid === uid) {
                  emailMatchPlayer = pData;
                  emailMatchPlayerId = pId;
                  if (!pData.ownerUid) {
                    await updateDoc(doc(db, 'players', pId), { claimed: true, ownerUid: uid, updatedAt: serverTimestamp() });
                  }
                  if (userRole === 'guest') userRole = 'player';
                }
              }
            }
          }
        } catch (playerErr) {
          console.warn("[AuthStore] Player identity discovery skipped (permission issue):", playerErr);
        }

        // --- STEP 3: CONSTRUCT FINAL USER DATA ---
        let finalUserData: any = {
          ...existingData,
          uid: uid,
          email: user.email || existingData.email || null,
          displayName: user.displayName || existingData.displayName || null,
          photoURL: user.photoURL || existingData.photoURL || null,
          role: userRole,
          lastLogin: serverTimestamp(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: (navigator as any).userAgentData?.platform || navigator.platform,
          }
        };

        if (isNewUser) finalUserData.createdAt = serverTimestamp();

        if (emailMatchPlayer && !isAdmin) {
          finalUserData.isRegisteredPlayer = true;
          finalUserData.playerId = emailMatchPlayerId;
          finalUserData.linkedPlayerId = emailMatchPlayerId;
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
        } else if (!isAdmin) {
          if (!existingData.isRegisteredPlayer) {
            finalUserData.isRegisteredPlayer = false;
            finalUserData.playerId = null;
            finalUserData.playerProfile = null;
          }
        } else {
          finalUserData.isRegisteredPlayer = false;
          finalUserData.playerId = null;
          finalUserData.playerProfile = null;
        }

        if (isNewUser) {
          await setDoc(userRef, finalUserData);
        } else {
          // If update fails due to permissions (e.g. creating own doc for first time but rule says allow write if auth != null)
          try {
            await updateDoc(userRef, finalUserData);
          } catch (updateErr) {
            console.log("[AuthStore] updateDoc failed, falling back to setDoc:", updateErr);
            await setDoc(userRef, finalUserData);
          }
        }

        console.log("[AuthStore] processLogin SUCCESS. Role:", finalUserData.role);
        set({ user: finalUserData as User, loading: false });

        const { followService } = await import('@/services/firestore/followService');
        followService.processPendingFollow();

        return isNewUser;
      } catch (error: any) {
        console.error("[AuthStore] processLogin ERROR:", error);

        // Final fallback: Ensure user is logged in as guest even on fatal Firestore errors
        const fallbackUser: any = {
          uid: uid,
          email: user.email || null,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          role: 'guest',
          userType: 'regular',
          createdAt: serverTimestamp()
        };
        set({ user: fallbackUser as User, loading: false });

        return false;
      } finally {
        activeProcessings.delete(uid);
        set({ isProcessing: false, isSyncingIdentity: false });
      }
    })();

    activeProcessings.set(uid, processPromise);
    return processPromise;
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

      const currentUser = get().user;
      if (currentUser && data.displayName && data.displayName !== currentUser.displayName) {
        const changeLogRef = doc(collection(db, 'name_changes'));
        await setDoc(changeLogRef, {
          uid: currentUser.uid,
          oldName: currentUser.displayName || 'Unnamed',
          newName: data.displayName,
          timestamp: serverTimestamp(),
          adminId: auth.currentUser?.uid || 'system'
        });
      }

      await updateDoc(userRef, profileUpdates);
      if (currentUser?.playerId) {
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

      set((state) => ({
        user: state.user ? { ...state.user, ...profileUpdates } : null
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
    setPersistence(auth, browserLocalPersistence).catch((e: any) => console.error("Persistence error:", e));

    let userUnsubscribe: (() => void) | null = null;

    getRedirectResult(auth).then(async (result: any) => {
      if (result && result.user) {
        console.log("[AuthStore] Redirect Result found:", result.user.email);
        toast.success("Redirect Login Successful!", { id: 'login-success' });
        await get().processLogin(result.user);
      }
    }).catch((e: any) => {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error("[AuthStore] Redirect Result Error:", e);
      }
    });

    onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        console.log("[AuthStore] AuthStateChanged: User Logged In", firebaseUser.email);
        set({ loading: true });

        const { onSnapshot } = await import('firebase/firestore');
        const userRef = doc(db, 'users', firebaseUser.uid);

        userUnsubscribe = onSnapshot(userRef, async (docSnap) => {
          if (get().isProcessing || get().isSyncingIdentity) {
            console.log("[AuthStore] Snapshot ignored - processing in progress.");
            return;
          }

          if (docSnap.exists()) {
            const data = docSnap.data() as User;
            const currentLocalUser = get().user;

            if (currentLocalUser && currentLocalUser.uid === firebaseUser.uid) {
              const localRole = currentLocalUser.role;
              const localIsPlayer = currentLocalUser.isRegisteredPlayer;

              const isRoleDowngrade = (localRole === 'admin' || localRole === 'super_admin' || localRole === 'player') &&
                (data.role === 'viewer' || data.role === 'guest' || !data.role);
              const isIdentityDowngrade = localIsPlayer && !data.isRegisteredPlayer;

              if (isRoleDowngrade || isIdentityDowngrade) {
                console.log("[AuthStore] Snapshot blocked identity/role downgrade (local priority).");
                return;
              }
            }

            if ((data.role === 'admin' || data.role === 'super_admin') && firebaseUser.email) {
              const { SUPER_ADMIN_EMAIL } = await import('@/services/firestore/admins');
              if (firebaseUser.email.toLowerCase().trim() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
                if (!firebaseUser.emailVerified) {
                  const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
                  if (adminDoc.exists() && adminDoc.data().emailVerified === false) {
                    toast.error('This account requires email verification.', { id: 'auth-revoked' });
                    await get().logout();
                    return;
                  }
                }
              }
            }

            get().syncSessionMetadata(firebaseUser);

            if (data.isRegisteredPlayer && firebaseUser.email) {
              try {
                const emailLower = firebaseUser.email.toLowerCase().trim();
                const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
                const secretsSnap = await getDocs(q);
                let verifiedPlayerId = !secretsSnap.empty ? secretsSnap.docs[0].id : null;

                if (!verifiedPlayerId) {
                  const pQ = query(collection(db, 'players'), where('email', '==', emailLower), limit(1));
                  const pSnap = await getDocs(pQ);
                  if (!pSnap.empty) {
                    const playerData = pSnap.docs[0].data();
                    if (playerData.ownerUid === firebaseUser.uid || !playerData.ownerUid) {
                      verifiedPlayerId = pSnap.docs[0].id;
                    }
                  }
                }

                if (data.playerId !== verifiedPlayerId) {
                  console.warn("[AuthStore] Identity mismatch. Force Logout.");
                  toast.error("Your profile access has been updated.", { id: 'auth-revoked' });
                  await get().logout();
                  return;
                }
              } catch (checkErr: any) {
                console.warn("[AuthStore] Identity check failed:", checkErr.message);
              }
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
        console.log("[AuthStore] AuthStateChanged: Clear");
        set({ user: null, loading: false });
      }
    });
  }
}));
