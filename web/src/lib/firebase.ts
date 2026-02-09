import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  ActionCodeSettings
} from "firebase/auth";

// Firebase config - LuLuAI Service
const firebaseConfig = {
  apiKey: "AIzaSyBHAFZbf7qmC9K517t2vrDdKq7Vmnbp5-Q",
  authDomain: "llm-service-3587a.firebaseapp.com",
  projectId: "llm-service-3587a",
  storageBucket: "llm-service-3587a.firebasestorage.app",
  messagingSenderId: "15010295976",
  appId: "1:15010295976:web:9f72fdff540c30e2f4529d",
  measurementId: "G-LWDT5C1ZX5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const signInWithEmail = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
  return signOut(auth);
};

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

export const sendCustomPasswordResetEmail = (email: string) => {
  const actionCodeSettings: ActionCodeSettings = {
    url: `${window.location.origin}/login`,
    handleCodeInApp: false,
  };
  
  return sendPasswordResetEmail(auth, email, actionCodeSettings);
};

export { onAuthStateChanged };
export type { User };
