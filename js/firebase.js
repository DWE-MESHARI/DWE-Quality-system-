// طبقة الربط مع Firebase: تهيئة + Firestore + المصادقة، بواجهة بسيطة يستخدمها app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
isSupported().then(ok => ok && getAnalytics(app)).catch(() => {});
const fs = getFirestore(app), auth = getAuth(app);

const snap = d => ({ id: d.id, data: () => d.data() });
export const DB = {
  collection: p => ({
    onSnapshot: (next, err) => onSnapshot(collection(fs, p), s => next({ docs: s.docs.map(snap) }), err),
    add: async data => ({ id: (await addDoc(collection(fs, p), data)).id })
  }),
  doc: path => ({
    set: data => setDoc(doc(fs, path), data),
    update: data => updateDoc(doc(fs, path), data),
    delete: () => deleteDoc(doc(fs, path)),
    onSnapshot: (next, err) => onSnapshot(doc(fs, path), s => next({ exists: s.exists(), data: () => s.data() }), err)
  })
};
export const onAuth = cb => onAuthStateChanged(auth, cb);
export const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);
export const getRole = async uid => { const s = await getDoc(doc(fs, "roles", uid)); return s.exists() ? s.data().role : null; };
