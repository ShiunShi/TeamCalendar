import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy accessors. Calling getAuth() / getFirestore() at module load time blows
// up during `next build` prerendering because env vars on Vercel may be absent
// at build time and Firebase rejects the empty apiKey. Function-style accessors
// defer initialization until a caller actually needs the instance — and they
// return real Firestore/Auth objects (a Proxy wrapper would fail the SDK's
// internal `instanceof Firestore` checks inside doc(), onAuthStateChanged, etc).
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getClientApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getAuthClient(): Auth {
  if (!_auth) _auth = getAuth(getClientApp());
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getClientApp());
  return _db;
}
