import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ⬇️ REMPLACE ce bloc par le firebaseConfig copié depuis la console Firebase
const firebaseConfig = {
  apiKey: "TA_CLE",
  authDomain: "tesla-tracker-xxxx.firebaseapp.com",
  projectId: "tesla-tracker-xxxx",
  storageBucket: "tesla-tracker-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxx"
};
// ⬆️ Fin du bloc à remplacer

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);