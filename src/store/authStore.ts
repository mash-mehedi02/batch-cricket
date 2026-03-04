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
const processingLogins = new Set<string>();

/**
 * Fetch IP and basic location info for security logging
 */
async function fetchConnectivityInfo() {
  try {
    const res = await fetch('https://ipapi.co/json/').catch(() => null);
    if (!res) return { ip: 'unknown', city: 'unknown', country: 'unknown' };
    const data = await res.json();
    return {
      ip: data.ip || 'unknown',
      city: data.city || 'unknown',
      country: data.country_name || 'unknown'
    };
  } catch (err) {
    return { ip: 'unknown', city: 'unknown', country: 'unknown' };
  }
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
  isProcessing: boolean
}


export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  isProcessing: false,

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
    if (processingLogins.has(user.uid)) {
      console.log("[AuthStore] Login already in process for:", user.uid);
      return false;
    }
    processingLogins.add(user.uid);
    set({ isProcessing: true });
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

      // --- STEP 1: ADMIN DISCOVERY (BY EMAIL) ---
      // PRIORITY: Admins can't be players (for UI/Action strictness)
      let isAdmin = false;
      if (user.email) {
        const emailLower = user.email.toLowerCase().trim();
        console.log("[AuthStore] Checking for Admin rights for:", emailLower);

        // HARDCODED SUPER ADMIN FALLBACK (Safety net for the primary account)
        const { SUPER_ADMIN_EMAIL } = await import('@/services/firestore/admins');
        if (emailLower === SUPER_ADMIN_EMAIL.toLowerCase()) {
          console.log("[AuthStore] Hardcoded Super Admin detected.");
          userRole = 'super_admin';
          isAdmin = true;
        } else {
          const adminQ = query(collection(db, 'admins'), where('email', '==', emailLower), limit(1));
          const adminSnap = await getDocs(adminQ);

          if (!adminSnap.empty) {
            const adminData = adminSnap.docs[0].data();
            if (adminData.isActive) {
              console.log("[AuthStore] Admin email match found! Granting privileges.");
              userRole = adminData.role || 'admin';
              isAdmin = true;

              // Sync UID if needed
              if (adminData.uid !== user.uid) {
                console.log("[AuthStore] Syncing Admin UID from", adminData.uid, "to", user.uid);
                await setDoc(doc(db, 'admins', user.uid), {
                  ...adminData,
                  uid: user.uid,
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }
      }

      // --- STEP 2: PLAYER IDENTITY LOOKUP (STRICT EMAIL MAPPING) ---
      // ONLY if not an admin
      if (user.email && !isAdmin) {
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
        } else {
          // FALLBACK 1: Search players collection directly for matching email (Legacy or Admin-Created)
          console.log("[AuthStore] No secret match, searching players collection directly for:", emailLower);
          const pQ = query(collection(db, 'players'), where('email', '==', emailLower), limit(1));
          const pSnap = await getDocs(pQ);

          if (!pSnap.empty) {
            const playerData = pSnap.docs[0].data();
            const pId = pSnap.docs[0].id;

            if (!playerData.ownerUid || playerData.ownerUid === user.uid) {
              emailMatchPlayer = playerData;
              emailMatchPlayerId = pId;

              // AUTO-UPGRADE: Create the secret entry to future-proof this account
              console.log("[AuthStore] Legacy/Admin-Created match found. Upgrading identity...");
              await setDoc(doc(db, 'player_secrets', pId), {
                email: emailLower,
                playerId: pId,
                uid: user.uid,
                upgradedAt: serverTimestamp()
              }).catch(e => console.warn("Identity upgrade failed:", e));

              // Claim it if unclaimed
              if (!playerData.ownerUid) {
                console.log("[AuthStore] Attempting to claim legacy player profile:", pId);
                await updateDoc(doc(db, 'players', pId), {
                  claimed: true,
                  ownerUid: user.uid,
                  lastVerifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log("[AuthStore] Profile claim successful.");
                toast.success('Player profile linked!', { icon: '🔗' });
              }

              if (userRole === 'viewer') userRole = 'player';
            }
          } else if (userSnap.exists() && userSnap.data().playerId) {
            // FALLBACK 2: No secret match found, but user document already has a playerId.
            const existingPlayerId = userSnap.data().playerId;
            console.log("[AuthStore] No email match, checking existing document playerId:", existingPlayerId);
            const playerSnap = await getDoc(doc(db, 'players', existingPlayerId));

            if (playerSnap.exists()) {
              const playerData = playerSnap.data();
              if (playerData.ownerUid === user.uid) {
                console.log("[AuthStore] Ownership verified for existing playerId.");
                emailMatchPlayer = playerData;
                emailMatchPlayerId = existingPlayerId;
                if (userRole === 'viewer') userRole = 'player';

                // Also upgrade this to secrets for faster future lookup
                await setDoc(doc(db, 'player_secrets', existingPlayerId), {
                  email: emailLower,
                  playerId: existingPlayerId,
                  uid: user.uid,
                  upgradedAt: serverTimestamp()
                }).catch(() => { });
              }
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

      // --- STEP 4: FORCE IDENTITY OVERWRITE ---
      // If we have a valid email match, NOTHING in the old record matters.
      // We overwrite everything related to player identity.
      if (emailMatchPlayer && !isAdmin) {
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
        // NO MATCH OR IS ADMIN: Revoke all player permissions and clear IDs
        console.log("[AuthStore] Cleaning up player identity (Admin or No Match).");
        finalUserData.isRegisteredPlayer = false;
        finalUserData.playerId = null;
        finalUserData.linkedPlayerId = null;
        finalUserData.playerProfile = null; // Clear profile for admins

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

      // Process any pending follow actions
      const { followService } = await import('@/services/firestore/followService');
      followService.processPendingFollow();

      console.log("[AuthStore] Identity Processing Complete. Final Role:", finalUserData.role);

      // --- STEP 5: LOG LOGIN ACTIVITY (non-blocking) ---
      // This must NEVER crash the login flow
      try {
        const connectivity = await fetchConnectivityInfo();
        const loginLogRef = doc(collection(db, 'login_logs'));
        await setDoc(loginLogRef, {
          uid: user.uid,
          email: user.email,
          timestamp: serverTimestamp(),
          ip: connectivity.ip,
          location: `${connectivity.city}, ${connectivity.country}`,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        });
      } catch (logErr) {
        console.warn('[AuthStore] Login log write failed (non-critical):', logErr);
      }

      return isNewUser;

    } catch (error: any) {
      console.error("[AuthStore] Process Login Error:", error);
      // Don't throw — Google Auth already succeeded. 
      // Set a basic user state so the user isn't stuck in a broken state.
      const fallbackUser = {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        role: 'viewer' as const,
      };
      set({ user: fallbackUser as User, loading: false });

      if (error.message?.includes('insufficient permissions') || error.code === 'permission-denied') {
        console.warn("[AuthStore] Firestore permissions issue - user logged in with basic profile");
      } else {
        toast.error(`Profile sync issue: ${error.message}`);
      }
      return false;
    } finally {
      processingLogins.delete(user.uid);
      set({ isProcessing: false, loading: false });
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

      const currentUser = get().user;

      // Log name change if applicable
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
        await get().processLogin(result.user);
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
            if (data.isRegisteredPlayer && firebaseUser.email) {
              try {
                const emailLower = firebaseUser.email.toLowerCase().trim();
                const q = query(collection(db, 'player_secrets'), where('email', '==', emailLower));
                const secretsSnap = await getDocs(q);
                let verifiedPlayerId = !secretsSnap.empty ? secretsSnap.docs[0].id : null;

                // FALLBACK: If no secret found, check players collection directly (Legacy/Admin-created)
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

                // IDENTITY CHECK: If admin changed the email or unlinked the player
                // we force a LOGOUT to ensure security and prevent ghost access.
                if (data.playerId !== verifiedPlayerId) {
                  console.warn("[AuthStore] Identity mismatch/revocation detected. Force Logout.");
                  toast.error("Your profile access has been updated. Please login again.", { id: 'auth-revoked' });
                  await get().logout();
                  return;
                }
              } catch (checkErr: any) {
                // If this fails (e.g. permission issue during session init), we don't log them out immediately
                // but we log it for debugging.
                console.warn("[AuthStore] Identity check failed (likely temporary):", checkErr.message);
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
        console.log("[AuthStore] AuthStateChanged: Clear (No Session)");
        set({ user: null, loading: false });
      }
    });
  }

}))
