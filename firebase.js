import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ⬇️ COLLE ICI ta vraie config copiée depuis la console Firebase
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "tesla-tracker-xxxx.firebaseapp.com",
  projectId: "tesla-tracker-xxxx",
  storageBucket: "tesla-tracker-xxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx"
};
// ⬆️ garde TES valeurs, pas celles-ci

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);