// بديل firebase/auth فوق Apps Script (تسجيل دخول من شيت Users)
import { apiCall } from "./api.js";

const KEY = "wavelift_user";
const mgr = { currentUser: readUser(), listeners: [] };

function readUser() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
}
function setUser(u) {
  mgr.currentUser = u;
  try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch (e) {}
  mgr.listeners.forEach((cb) => { try { cb(u); } catch (e) {} });
}

export const browserLocalPersistence = "local";
export function getAuth() { return mgr; }
export function setPersistence() { return Promise.resolve(); }

export function onAuthStateChanged(_auth, cb) {
  mgr.listeners.push(cb);
  try { cb(mgr.currentUser); } catch (e) {}
  return () => { const i = mgr.listeners.indexOf(cb); if (i > -1) mgr.listeners.splice(i, 1); };
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const r = await apiCall("login", { email, password });
  if (!r || r.ok === false) {
    const err = new Error((r && r.message) || "فشل تسجيل الدخول");
    err.code = "auth/invalid-credential";
    throw err;
  }
  const user = { uid: r.user.uid, email: r.user.email, displayName: r.user.displayName || "", role: r.user.role || "coach" };
  setUser(user);
  return { user };
}

export async function createUserWithEmailAndPassword(_auth, email) {
  // لا يوجد نظام مصادقة حقيقي؛ نُنشئ معرّفًا فقط (اللاعب يدخل بالرمز).
  const user = { uid: "P" + Date.now(), email: email || "", displayName: "" };
  return { user };
}
export function updateProfile(user, data) {
  if (user && data && data.displayName) user.displayName = data.displayName;
  return Promise.resolve();
}
export function signOut() { setUser(null); return Promise.resolve(); }
export function sendPasswordResetEmail() {
  // نسخة Sheets: لا يوجد إرسال بريد — كلمات المرور تُدار من تبويب Users في الشيت.
  const err = new Error("في هذه النسخة تُغيَّر كلمة المرور من ملف Google Sheet (تبويب Users). تواصل مع الأدمن.");
  return Promise.reject(err);
}
