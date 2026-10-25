import { readFirebaseConfig } from './publicFirebaseConfig';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const crmFirebaseConfig = readFirebaseConfig(import.meta.env?.VITE_FIREBASE_CONFIG, 'VITE_FIREBASE_CONFIG');

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
