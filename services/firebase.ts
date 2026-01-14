
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Firebaseコンソールから取得した設定値に書き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyB2eRljzMlQfb5RI26Sw99rYjpG9ww38Bk",
  authDomain: "ikkyuusokuhou.firebaseapp.com",
  projectId: "ikkyuusokuhou",
  storageBucket: "ikkyuusokuhou.firebasestorage.app",
  messagingSenderId: "192942341354",
  appId: "1:192942341354:web:30c5e1a7a7338da63b2b93",
  measurementId: "G-TGNSL1KTM1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
