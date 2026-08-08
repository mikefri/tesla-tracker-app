import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ⬇️ COLLE ICI ta vraie config copiée depuis la console Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDHYMRJpVUXCE5JA7YhODPd45SJQwwWI1Q",
  authDomain: "tesla-tracker-83265.firebaseapp.com",
  projectId: "tesla-tracker-83265",
  storageBucket: "tesla-tracker-83265.firebasestorage.app",
  messagingSenderId: "600609675439",
  appId: "1:600609675439:web:192308ea8c8eae5ecadc5a"
};
// ⬆️ garde TES valeurs, pas celles-ci

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);