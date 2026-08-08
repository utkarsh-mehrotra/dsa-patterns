import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Original credentials for the algoflow-dsa live deployment
const firebaseConfig = {
  apiKey: "AIzaSyDPWD-4mTEDkLHxQFLyMk3qs7SlGeXrKeM",
  authDomain: "algoflow-dsa.firebaseapp.com",
  projectId: "algoflow-dsa",
  storageBucket: "algoflow-dsa.firebasestorage.app",
  messagingSenderId: "1020592728923",
  appId: "1:1020592728923:web:a8025700a30abaa16f487e",
  measurementId: "G-5NG56TG7BF"
};

console.log("⚡ [AlgoFlow Firebase] Initializing Firebase App and Services...");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export const db = getFirestore(app);
