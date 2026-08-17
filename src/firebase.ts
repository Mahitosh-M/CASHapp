import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const crmFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyATEp0aDCh1vLcI21KB3Nphy5Rygy7_CMU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cisapp-236ab.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cisapp-236ab',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'cisapp-236ab.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '835565586103',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:835565586103:web:c46c8f8137288c21366f32'
};

export const app = getApps().length > 0 ? getApp() : initializeApp(crmFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const emulatorState = globalThis as typeof globalThis & {
  __cashAppFirebaseEmulatorsConnected?: boolean;
};

if (
  import.meta.env.DEV
  && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  && !emulatorState.__cashAppFirebaseEmulatorsConnected
) {
  connectAuthEmulator(
    auth,
    import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099',
    { disableWarnings: true }
  );
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080)
  );
  emulatorState.__cashAppFirebaseEmulatorsConnected = true;
}
