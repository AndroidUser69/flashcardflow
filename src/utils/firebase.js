// src/utils/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, writeBatch, getDocs, deleteField, deleteDoc, onSnapshot } from "firebase/firestore";

// Configuração copiada do seu projeto
const firebaseConfig = {
    apiKey: "AIzaSyApOjZZ75TyDD126CyN4kF7dVeoMvAo5dk",
    authDomain: "estudos-ec4c5.firebaseapp.com",
    projectId: "estudos-ec4c5",
    storageBucket: "estudos-ec4c5.firebasestorage.app",
    messagingSenderId: "152433763794",
    appId: "1:152433763794:web:31b8b3fc2f2ee7ae4ed40b",
    measurementId: "G-YVK8REQRF8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exportando funções para os outros arquivos usarem
export { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
    doc, setDoc, getDoc, collection, writeBatch, getDocs, deleteField, deleteDoc, onSnapshot
};