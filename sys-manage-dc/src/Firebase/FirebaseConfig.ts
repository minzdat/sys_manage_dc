// src/Firebase/FirebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBUJOR0UXP-MsHvzblD7mLsWQAOSjNyYFQ",
  authDomain: "sys-manage-dc-9c480.firebaseapp.com",
  databaseURL: "https://sys-manage-dc-9c480-default-rtdb.firebaseio.com",
  projectId: "sys-manage-dc-9c480",
  storageBucket: "sys-manage-dc-9c480.firebasestorage.app",
  messagingSenderId: "573023439455",
  appId: "1:573023439455:web:ee42e43973d02e2c79a9ea",
  measurementId: "G-DW576LW9W3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { auth, db }; 