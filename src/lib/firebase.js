import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, onValue, get, update } from "firebase/database";

const firebaseConfig = {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.PUBLIC_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
};

// Anti-Crash SPA: Inicializar Firebase solo si no está inicializado ya
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);

export { ref, onValue, get, update };
