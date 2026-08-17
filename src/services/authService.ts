import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { StaffProfile } from '../types';
import { isShopId } from '../utils/shops';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const listenToAuthState = (callback: (user: User | null) => void) => onAuthStateChanged(auth, callback);

export const loginWithEmail = async (email: string, password: string) => {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, normalizeEmail(email), password);
};

export const logoutUser = () => signOut(auth);

export const loadCashAppProfile = async (user: User): Promise<StaffProfile> => {
  const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
  if (!profileSnapshot.exists()) {
    throw new Error('This account does not have Cash App access. Please contact Admin.');
  }

  const data = profileSnapshot.data();
  if (data.uid !== user.uid || (data.role !== 'Staff' && data.role !== 'Admin')) {
    throw new Error('This account is not authorized for the Cash App.');
  }
  if (data.active !== true) {
    throw new Error('This account is inactive. Please contact Admin.');
  }
  if (data.role === 'Staff' && !isShopId(data.shopId)) {
    throw new Error('This staff account has not been assigned to a shop. Please contact Admin.');
  }

  return {
    id: profileSnapshot.id,
    uid: user.uid,
    email: String(data.email || user.email || ''),
    name: String(data.name || 'Staff'),
    role: data.role,
    ...(isShopId(data.shopId) ? { shopId: data.shopId } : {}),
    active: true
  };
};

export const getFriendlyLoginError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Email or password is incorrect.';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (code === 'auth/network-request-failed') return 'Check your internet connection and try again.';
  if (code === 'permission-denied') return 'This account does not have Cash App access. Please contact Admin.';
  if (code === 'unavailable') return 'Check your internet connection and try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'Login could not be completed. Please try again.';
};
