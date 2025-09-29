import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAlJEh8L0r-p42oxY5PkkvBG3Xrh7wgdU4",
  authDomain: "agriculture-9d2bf.firebaseapp.com",
  projectId: "agriculture-9d2bf",
  storageBucket: "agriculture-9d2bf.firebasestorage.app",
  messagingSenderId: "1048860855977",
  appId: "1:1048860855977:web:c9fb2f655687c0c95ca3b8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export default app;