import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdMGOQvJEIee6uWYoPslxkncIexzijlS0",
  authDomain: "sale-performance-tracker.firebaseapp.com",
  projectId: "sale-performance-tracker",
  storageBucket: "sale-performance-tracker.appspot.com",
  messagingSenderId: "302921583424",
  appId: "1:302921583424:web:9b15214e687258cd60c8a5",
};
// 🔹 MAIN APP (login ke liye)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 🔹 SECONDARY APP (create user ke liye – logout nahi karega)
const secondaryApp = initializeApp(firebaseConfig, "SECONDARY");
export const secondaryAuth = getAuth(secondaryApp);

export const db = getFirestore(app);
