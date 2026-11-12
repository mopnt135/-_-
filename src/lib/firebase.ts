import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AdminAIConfig } from '../data/adminConfig';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Sync Admin Config with Firestore
export async function saveAdminConfigToFirestore(config: AdminAIConfig, userEmail?: string) {
  try {
    const ref = doc(db, 'admin_configs', 'general');
    await setDoc(ref, {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail || auth.currentUser?.email || 'anonymous'
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore sync warning (falling back to localStorage):', err);
  }
}

export async function loadAdminConfigFromFirestore(): Promise<AdminAIConfig | null> {
  try {
    const ref = doc(db, 'admin_configs', 'general');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as AdminAIConfig;
    }
    return null;
  } catch (err) {
    console.warn('Could not load from Firestore, using local config:', err);
    return null;
  }
}
