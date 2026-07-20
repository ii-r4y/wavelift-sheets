import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore/lite";

import { auth, db } from "./config.js";
import { COLLECTIONS, createFirebaseError, requireFields } from "./database.js";

let persistenceReady;

async function ensureAuthPersistence() {
  if (!persistenceReady) {
    persistenceReady = setPersistence(auth, browserLocalPersistence);
  }

  return persistenceReady;
}

export async function loginCoach(email, password) {
  requireFields({ email, password }, ["email", "password"]);

  try {
    await ensureAuthPersistence();

    const credential = await signInWithEmailAndPassword(auth, email, password);

    return {
      user: credential.user,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to log in coach.");
  }
}

export async function loginAdmin(email, password) {
  requireFields({ email, password }, ["email", "password"]);

  try {
    await ensureAuthPersistence();

    const credential = await signInWithEmailAndPassword(auth, email, password);

    return {
      user: credential.user,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to log in admin.");
  }
}

export async function logoutCoach() {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to log out coach.");
  }
}

export async function resetPassword(email) {
  requireFields({ email }, ["email"]);

  try {
    await ensureAuthPersistence();
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to send password reset email.");
  }
}

export function watchAuthState(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("watchAuthState requires a callback function.");
  }

  return onAuthStateChanged(auth, callback);
}

export async function createPlayerAccount({
  email,
  password,
  displayName,
  playerId,
  metadata = {},
}) {
  requireFields({ email, password }, ["email", "password"]);

  try {
    await ensureAuthPersistence();

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    const targetPlayerId = playerId || credential.user.uid;
    await setDoc(
      doc(db, COLLECTIONS.players, targetPlayerId),
      {
        ...metadata,
        authUid: credential.user.uid,
        email,
        name: displayName || metadata.name || "",
        accountType: "player",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    return {
      user: credential.user,
      playerId: targetPlayerId,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to create player account.");
  }
}
