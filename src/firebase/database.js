import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc as fbGetDoc,
  getDocs as fbGetDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore/lite";

import { db } from "./config.js";

// [تحسين موثوقية] مهلة زمنية لكل قراءة من قاعدة البيانات، حتى لا تتجمّد
// الواجهة إلى ما لا نهاية إذا تعلّق الاتصال. عند تجاوز المهلة يُرمى خطأ
// واضح تلتقطه معالجات try/catch الموجودة وتعرضه للمستخدم.
const FIRESTORE_TIMEOUT_MS = 12000;
function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            "تعذّر الاتصال بالخادم، تحقّق من الإنترنت وحاول مرة أخرى.",
          ),
        ),
      FIRESTORE_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function getDoc(ref) {
  return withTimeout(fbGetDoc(ref));
}
function getDocs(refOrQuery) {
  return withTimeout(fbGetDocs(refOrQuery));
}

export const COLLECTIONS = Object.freeze({
  admins: "admins",
  coaches: "coaches",
  players: "players",
  attendance: "attendance",
  schedules: "schedules",
  dailyWorkouts: "dailyWorkouts",
  announcements: "announcements",
  sports: "sports",
  settings: "settings",
  gymExercises: "gymExercises",
  gymPrograms: "gymPrograms",
  gymExerciseTemplates: "gymExerciseTemplates",
});

// TODO Firestore Security Rules:
// - only admins can access adminDash management data.
// - coaches can access their sport/player data only.
// - players can read only allowed player-facing data.

export function createFirebaseError(error, fallbackMessage) {
  const wrapped = new Error(error?.message || fallbackMessage);
  wrapped.code = error?.code || "firebase/unknown";
  if (error?.playerId) wrapped.playerId = error.playerId;
  wrapped.cause = error;
  return wrapped;
}

export function requireFields(data, fields) {
  fields.forEach((field) => {
    if (data?.[field] === undefined || data?.[field] === null || data?.[field] === "") {
      throw new TypeError(`${field} is required.`);
    }
  });
}

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeSportId(sportId) {
  return String(sportId || "").trim().toLowerCase();
}

const SPORT_PLAYER_PREFIXES = Object.freeze({
  weightlifting: "WT",
  swimming: "SW",
  karate: "KA",
  "jiu-jitsu": "JJ",
  jiujitsu: "JJ",
  badminton: "BM",
  basketball: "BB",
  volleyball: "VB",
  athletics: "AT",
  gym: "GY",
});

function normalizeIdentityNumber(value) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/\D/g, "");
}

function playerPrefixForSport(sportId) {
  const normalized = normalizeSportId(sportId);
  if (SPORT_PLAYER_PREFIXES[normalized]) {
    return SPORT_PLAYER_PREFIXES[normalized];
  }

  const fallback = String(sportId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase();
  if (fallback.length === 2) return fallback;

  throw new TypeError("sportId must have a registered player prefix.");
}

function playerDocumentId(playerData) {
  const nationalId = normalizeIdentityNumber(
    playerData.nationalId || playerData.identity,
  );
  if (nationalId.length < 4) {
    throw new TypeError("nationalId must contain at least 4 digits.");
  }

  return `${playerPrefixForSport(playerData.sportId)}${nationalId.slice(-4)}`;
}

function sameSportId(left, right) {
  return normalizeSportId(left) === normalizeSportId(right);
}

function scheduleDocumentId(sportId) {
  const value = String(sportId || "").trim();
  if (!value || value.includes("/")) {
    throw new TypeError("sportId must be a valid Firestore document ID.");
  }
  return value;
}

function normalizeCoachSnapshot(coachSnapshot) {
  return {
    id: coachSnapshot.id,
    ...coachSnapshot.data(),
  };
}

export async function addPlayer(playerData) {
  requireFields(playerData, ["name", "nationalId", "sportId"]);

  try {
    const nationalId = normalizeIdentityNumber(playerData.nationalId);
    const playerId = playerDocumentId({
      ...playerData,
      nationalId,
    });
    const playersRef = collection(db, COLLECTIONS.players);
    const snapshot = await getDocs(playersRef);
    const duplicate = snapshot.docs.find((playerDoc) => {
      const savedNationalId = normalizeIdentityNumber(
        playerDoc.data().nationalId || playerDoc.data().identity,
      );
      return savedNationalId && savedNationalId === nationalId;
    });

    if (duplicate) {
      const duplicateError = new Error("This national ID is already registered.");
      duplicateError.code = "player/duplicate-national-id";
      duplicateError.playerId =
        duplicate.data().playerId || duplicate.id;
      throw duplicateError;
    }

    const playerRef = doc(db, COLLECTIONS.players, playerId);
    const existingPlayer = await getDoc(playerRef);
    if (existingPlayer.exists()) {
      const conflictError = new Error("The generated player ID is already in use.");
      conflictError.code = "player/id-conflict";
      conflictError.playerId = playerId;
      throw conflictError;
    }

    const payload = cleanPayload({
      ...playerData,
      nationalId,
      playerId,
      attendance: Number(playerData.attendance) || 0,
      absent: Number(playerData.absent) || 0,
      late: Number(playerData.late) || 0,
      excused: Number(playerData.excused) || 0,
      points: Number(playerData.points) || 0,
      source: playerData.source || "website",
      active: playerData.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(playerRef, payload);

    return {
      id: playerId,
      ...payload,
      playerId,
      nationalId,
      active: payload.active,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add player.");
  }
}

export async function getPlayers(filters = {}) {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.players));

    return snapshot.docs
      .map((playerDoc) => ({
        id: playerDoc.id,
        ...playerDoc.data(),
      }))
      .filter((player) => {
        if (filters.coachId && player.coachId !== filters.coachId) return false;
        if (filters.sportId && player.sportId !== filters.sportId) return false;
        if (filters.sport && player.sport !== filters.sport) return false;
        if (filters.group && player.group !== filters.group) return false;
        if (filters.active !== undefined && player.active !== filters.active) {
          return false;
        }

        return true;
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load players.");
  }
}

export async function updatePlayerNote(playerId, note) {
  requireFields({ playerId }, ["playerId"]);

  try {
    await setDoc(
      doc(db, COLLECTIONS.players, String(playerId)),
      {
        note: note || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to update player note.");
  }
}

export async function deleteAttendanceRecordById(recordId) {
  requireFields({ recordId }, ["recordId"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.attendance, String(recordId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete attendance record.");
  }
}

export async function deleteAttendanceRecord(playerId, date) {
  requireFields({ playerId, date }, ["playerId", "date"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.attendance, `${date}_${playerId}`));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete attendance record.");
  }
}

export async function updateAttendance(attendanceData) {
  requireFields(attendanceData, ["playerId"]);

  try {
    const date = attendanceData.date || new Date().toISOString().slice(0, 10);
    const attendanceId = attendanceData.id || `${date}_${attendanceData.playerId}`;
    const payload = cleanPayload({
      ...attendanceData,
      date,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.attendance, attendanceId), payload, {
      merge: true,
    });

    return {
      id: attendanceId,
      ...attendanceData,
      date,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update attendance.");
  }
}

export async function getAttendance(date) {
  requireFields({ date }, ["date"]);

  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.attendance));

    return snapshot.docs
      .map((attendanceDoc) => ({
        id: attendanceDoc.id,
        ...attendanceDoc.data(),
      }))
      .filter((attendance) => attendance.date === date);
  } catch (error) {
    throw createFirebaseError(error, "Unable to load attendance.");
  }
}

export async function saveSchedule(scheduleData) {
  requireFields(scheduleData, ["sportId"]);

  try {
    const { id: _ignoredId, ...scheduleFields } = scheduleData;
    const scheduleId = scheduleDocumentId(scheduleData.sportId);
    const payload = cleanPayload({
      ...scheduleFields,
      sportId: scheduleData.sportId,
      type: "weekly",
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.schedules, scheduleId), payload, {
      merge: true,
    });

    return {
      id: scheduleId,
      ...scheduleFields,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to save schedule.");
  }
}

export async function getSchedule(sportId) {
  requireFields({ sportId }, ["sportId"]);

  try {
    const scheduleId = scheduleDocumentId(sportId);
    let scheduleSnapshot = await getDoc(
      doc(db, COLLECTIONS.schedules, scheduleId),
    );

    if (!scheduleSnapshot.exists()) {
      scheduleSnapshot = await getDoc(
        doc(db, COLLECTIONS.schedules, `${scheduleId}_weekly`),
      );
    }

    if (!scheduleSnapshot.exists()) return null;

    const schedule = scheduleSnapshot.data();
    if (!sameSportId(schedule.sportId, sportId)) {
      return null;
    }

    return {
      id: scheduleSnapshot.id,
      ...schedule,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to load schedule.");
  }
}

export async function addDailyWorkout(workoutData) {
  requireFields(workoutData, ["title", "details", "sportId"]);

  try {
    const payload = cleanPayload({
      ...workoutData,
      active: workoutData.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const workoutRef = await addDoc(collection(db, COLLECTIONS.dailyWorkouts), payload);

    return {
      id: workoutRef.id,
      ...workoutData,
      active: payload.active,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add daily workout.");
  }
}

export async function getDailyWorkouts(filters = {}) {
  requireFields(filters, ["sportId"]);

  try {
    const snapshot = await getDocs(
      query(
        collection(db, COLLECTIONS.dailyWorkouts),
        where("sportId", "==", filters.sportId),
      ),
    );

    return snapshot.docs
      .map((workoutDoc) => ({
        id: workoutDoc.id,
        ...workoutDoc.data(),
      }))
      .filter((workout) => {
        if (filters.sportId && workout.sportId !== filters.sportId) return false;
        if (filters.sport && workout.sport !== filters.sport) return false;
        if (filters.group && workout.group !== filters.group) return false;
        if (filters.active !== undefined && workout.active !== filters.active) {
          return false;
        }

        return true;
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load daily workouts.");
  }
}

export async function deleteDailyWorkout(workoutId, sportId) {
  requireFields({ workoutId, sportId }, ["workoutId", "sportId"]);

  try {
    const workoutRef = doc(db, COLLECTIONS.dailyWorkouts, String(workoutId));
    const workoutSnapshot = await getDoc(workoutRef);
    if (!workoutSnapshot.exists()) return true;
    if (!sameSportId(workoutSnapshot.data().sportId, sportId)) {
      const error = new Error("Workout does not belong to the current sport.");
      error.code = "permission-denied";
      throw error;
    }
    await deleteDoc(workoutRef);
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete daily workout.");
  }
}

export async function saveSportSettings(sportData) {
  requireFields(sportData, ["sportId"]);

  try {
    const { id, ...sportFields } = sportData;
    const sportRefId = id || sportData.sportId;
    const payload = cleanPayload({
      ...sportFields,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.sports, sportRefId), payload, {
      merge: true,
    });

    return {
      id: sportRefId,
      ...sportFields,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to save sport settings.");
  }
}

export async function getSportSettings(sportId) {
  requireFields({ sportId }, ["sportId"]);

  try {
    const sportSnapshot = await getDoc(doc(db, COLLECTIONS.sports, sportId));

    if (!sportSnapshot.exists()) {
      return null;
    }

    return {
      id: sportSnapshot.id,
      ...sportSnapshot.data(),
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to load sport settings.");
  }
}

export async function getSports(filters = {}) {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.sports));

    return snapshot.docs
      .map((sportDoc) => ({
        id: sportDoc.id,
        ...sportDoc.data(),
      }))
      .filter((sport) => {
        if (filters.active !== undefined && sport.active !== filters.active) {
          return false;
        }

        return true;
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load sports.");
  }
}

export async function addSport(sportData) {
  requireFields(sportData, ["nameAr"]);

  try {
    const { id, ...sportFields } = sportData;
    const payload = cleanPayload({
      ...sportFields,
      active: sportFields.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (id) {
      await setDoc(doc(db, COLLECTIONS.sports, String(id)), payload, {
        merge: true,
      });
      return { id: String(id), ...sportFields, active: payload.active };
    }

    const sportRef = await addDoc(collection(db, COLLECTIONS.sports), payload);
    return { id: sportRef.id, ...sportFields, active: payload.active };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add sport.");
  }
}

export async function updateSport(sportId, sportData) {
  requireFields({ sportId }, ["sportId"]);

  try {
    const payload = cleanPayload({
      ...sportData,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.sports, String(sportId)), payload, {
      merge: true,
    });

    return { id: String(sportId), ...sportData };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update sport.");
  }
}

export async function deleteSport(sportId) {
  requireFields({ sportId }, ["sportId"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.sports, String(sportId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete sport.");
  }
}

export async function getCoachProfile(identity = {}) {
  const email = normalizeEmail(identity.email);
  const uid = String(identity.uid || "").trim();

  if (!email && !uid) {
    throw new TypeError("email or uid is required.");
  }

  try {
    const seen = new Set();
    const candidates = [];

    function addCoachSnapshot(coachSnapshot) {
      if (!coachSnapshot.exists() || seen.has(coachSnapshot.id)) return;
      seen.add(coachSnapshot.id);
      candidates.push(normalizeCoachSnapshot(coachSnapshot));
    }

    async function addCoachById(id) {
      if (!id) return;
      addCoachSnapshot(await getDoc(doc(db, COLLECTIONS.coaches, String(id))));
    }

    async function addCoachByField(field, value) {
      if (!value) return;
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.coaches),
          where(field, "==", value),
          limit(5),
        ),
      );
      snapshot.docs.forEach((coachSnapshot) => addCoachSnapshot(coachSnapshot));
    }

    await addCoachById(uid);
    await addCoachById(email);
    await addCoachByField("email", email);
    await addCoachByField("uid", uid);
    await addCoachByField("authUid", uid);

    const matches = candidates.filter((coach) => {
      const coachEmail = normalizeEmail(coach.email || coach.id);
      const coachIds = [coach.uid, coach.authUid, coach.id].map((value) =>
        String(value || "").trim(),
      );
      const matchesEmail = email && coachEmail === email;
      const matchesUid = uid && coachIds.includes(uid);
      const accountType = String(coach.accountType || "coach").trim().toLowerCase();
      const isCoach = accountType === "coach";

      return isCoach && (matchesEmail || matchesUid);
    });

    return matches.find((coach) => coach.sportId) || matches[0] || null;
  } catch (error) {
    throw createFirebaseError(error, "Unable to load coach profile.");
  }
}

export async function getCoaches(filters = {}) {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.coaches));

    return snapshot.docs
      .map((coachDoc) => ({
        id: coachDoc.id,
        ...coachDoc.data(),
      }))
      .filter((coach) => {
        if (filters.sportId && coach.sportId !== filters.sportId) return false;
        if (filters.active !== undefined && coach.active !== filters.active) {
          return false;
        }

        return true;
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load coaches.");
  }
}

export async function addCoach(coachData) {
  requireFields(coachData, ["name", "email"]);

  try {
    const { id, uid, ...coachFields } = coachData;
    const coachRefId = uid || id;
    const payload = cleanPayload({
      ...coachFields,
      uid: uid || "",
      role: "coach",
      active: coachFields.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (coachRefId) {
      await setDoc(doc(db, COLLECTIONS.coaches, String(coachRefId)), payload, {
        merge: true,
      });
      return { id: String(coachRefId), ...payload };
    }

    const coachRef = await addDoc(collection(db, COLLECTIONS.coaches), payload);
    return { id: coachRef.id, ...payload };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add coach.");
  }
}

export async function updateCoach(coachId, coachData) {
  requireFields({ coachId }, ["coachId"]);

  try {
    const payload = cleanPayload({
      ...coachData,
      role: coachData.role || "coach",
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.coaches, String(coachId)), payload, {
      merge: true,
    });

    return { id: String(coachId), ...coachData };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update coach.");
  }
}

export async function deleteCoach(coachId) {
  requireFields({ coachId }, ["coachId"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.coaches, String(coachId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete coach.");
  }
}

export async function getAnnouncements() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.announcements));
    return snapshot.docs
      .map((announcementDoc) => ({
        id: announcementDoc.id,
        ...announcementDoc.data(),
      }))
      .filter((announcement) => announcement.active !== false)
      .sort((left, right) => {
        const time = (value) =>
          value?.seconds || Date.parse(value || "") / 1000 || 0;
        return time(right.updatedAt || right.createdAt) -
          time(left.updatedAt || left.createdAt);
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load announcements.");
  }
}

export async function saveAnnouncement(announcementData) {
  requireFields(announcementData, ["body"]);
  try {
    const id = announcementData.id || "";
    const payload = cleanPayload({
      title: announcementData.title || "",
      body: announcementData.body,
      active: announcementData.active ?? true,
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() }),
    });
    if (id) {
      await setDoc(doc(db, COLLECTIONS.announcements, id), payload, {
        merge: true,
      });
      return { id, ...announcementData };
    }
    const announcementRef = await addDoc(
      collection(db, COLLECTIONS.announcements),
      payload,
    );
    return { id: announcementRef.id, ...announcementData };
  } catch (error) {
    throw createFirebaseError(error, "Unable to save announcement.");
  }
}

export async function deleteAnnouncement(announcementId) {
  requireFields({ announcementId }, ["announcementId"]);
  try {
    await deleteDoc(
      doc(db, COLLECTIONS.announcements, String(announcementId)),
    );
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete announcement.");
  }
}

export async function getAdminProfile(user) {
  const uid = typeof user === "string" ? user : user?.uid;
  const email = (typeof user === "object" ? user?.email : "") || "";

  try {
    if (uid) {
      const adminSnapshot = await getDoc(doc(db, COLLECTIONS.admins, uid));
      if (adminSnapshot.exists()) {
        return {
          id: adminSnapshot.id,
          ...adminSnapshot.data(),
        };
      }
    }

    if (!email) return null;

    const normalizedEmail = email.trim().toLowerCase();
    const snapshot = await getDocs(collection(db, COLLECTIONS.admins));
    const match = snapshot.docs.find((adminDoc) => {
      const data = adminDoc.data();
      return String(data.email || "").trim().toLowerCase() === normalizedEmail;
    });

    if (!match) return null;

    return {
      id: match.id,
      ...match.data(),
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to load admin profile.");
  }
}

export async function isAdminUser(user) {
  const profile = await getAdminProfile(user);
  return Boolean(profile && profile.active !== false);
}

export async function getAllPlayers(filters = {}) {
  return getPlayers(filters);
}

export async function normalizePlayerRecord(playerDocId) {
  requireFields({ playerDocId }, ["playerDocId"]);

  try {
    const sourceId = String(playerDocId);
    const sourceRef = doc(db, COLLECTIONS.players, sourceId);
    const sourceSnapshot = await getDoc(sourceRef);
    if (!sourceSnapshot.exists()) {
      const missingError = new Error("Player record was not found.");
      missingError.code = "player/not-found";
      throw missingError;
    }

    const sourceData = sourceSnapshot.data();
    const nationalId = normalizeIdentityNumber(
      sourceData.nationalId || sourceData.identity,
    );
    const canonicalId = playerDocumentId({
      ...sourceData,
      nationalId,
    });
    const targetRef = doc(db, COLLECTIONS.players, canonicalId);
    const targetSnapshot =
      canonicalId === sourceId ? sourceSnapshot : await getDoc(targetRef);
    const targetData = targetSnapshot.exists() ? targetSnapshot.data() : {};
    const targetNationalId = normalizeIdentityNumber(
      targetData.nationalId || targetData.identity,
    );

    if (
      canonicalId !== sourceId &&
      targetSnapshot.exists() &&
      targetNationalId &&
      targetNationalId !== nationalId
    ) {
      const conflictError = new Error("The canonical player ID is already in use.");
      conflictError.code = "player/id-conflict";
      conflictError.playerId = canonicalId;
      throw conflictError;
    }

    const maximumCounter = (field) =>
      Math.max(Number(sourceData[field]) || 0, Number(targetData[field]) || 0);
    const normalizedPlayer = cleanPayload({
      ...sourceData,
      ...targetData,
      nationalId,
      playerId: canonicalId,
      attendance: maximumCounter("attendance"),
      absent: maximumCounter("absent"),
      late: maximumCounter("late"),
      excused: maximumCounter("excused"),
      points: maximumCounter("points"),
      active: targetData.active ?? sourceData.active ?? true,
      source: targetData.source || sourceData.source || "migrated",
      migratedFrom: canonicalId === sourceId ? undefined : sourceId,
      updatedAt: serverTimestamp(),
    });

    await setDoc(targetRef, normalizedPlayer, { merge: true });

    let migratedAttendance = 0;
    if (canonicalId !== sourceId) {
      const attendanceSnapshot = await getDocs(
        collection(db, COLLECTIONS.attendance),
      );
      const linkedAttendance = attendanceSnapshot.docs.filter(
        (attendanceDoc) =>
          String(attendanceDoc.data().playerId || "") === sourceId,
      );

      for (const attendanceDoc of linkedAttendance) {
        const attendanceData = attendanceDoc.data();
        const targetAttendanceId = attendanceData.date
          ? `${attendanceData.date}_${canonicalId}`
          : attendanceDoc.id.replace(sourceId, canonicalId);
        await setDoc(
          doc(db, COLLECTIONS.attendance, targetAttendanceId),
          {
            ...attendanceData,
            playerId: canonicalId,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        if (targetAttendanceId !== attendanceDoc.id) {
          await deleteDoc(attendanceDoc.ref);
        }
        migratedAttendance++;
      }

      await deleteDoc(sourceRef);
    }

    return {
      id: canonicalId,
      playerId: canonicalId,
      migratedFrom: canonicalId === sourceId ? "" : sourceId,
      migratedAttendance,
      ...normalizedPlayer,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to normalize player record.");
  }
}

export async function updatePlayer(playerId, playerData) {
  requireFields({ playerId }, ["playerId"]);

  try {
    const payload = cleanPayload({
      ...playerData,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.players, String(playerId)), payload, {
      merge: true,
    });

    return { id: String(playerId), ...playerData };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update player.");
  }
}

export async function deletePlayer(playerId) {
  requireFields({ playerId }, ["playerId"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.players, String(playerId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete player.");
  }
}

export async function getAttendanceRecords(filters = {}) {
  try {
    const rangeConstraints = [];
    if (filters.dateFrom)
      rangeConstraints.push(where("date", ">=", filters.dateFrom));
    if (filters.dateTo)
      rangeConstraints.push(where("date", "<=", filters.dateTo));
    const attendanceRef = collection(db, COLLECTIONS.attendance);
    const attendanceQuery = rangeConstraints.length
      ? query(attendanceRef, ...rangeConstraints)
      : attendanceRef;
    const snapshot = await getDocs(attendanceQuery);

    return snapshot.docs
      .map((attendanceDoc) => ({
        id: attendanceDoc.id,
        ...attendanceDoc.data(),
      }))
      .filter((entry) => {
        if (filters.date && entry.date !== filters.date) return false;
        if (filters.dateFrom && entry.date < filters.dateFrom) return false;
        if (filters.dateTo && entry.date > filters.dateTo) return false;
        if (filters.sport && entry.sport !== filters.sport) return false;
        if (filters.sportId && entry.sportId !== filters.sportId) return false;
        if (filters.coachId && entry.coachId !== filters.coachId) return false;

        return true;
      });
  } catch (error) {
    throw createFirebaseError(error, "Unable to load attendance records.");
  }
}

export async function getReportsSummary(filters = {}) {
  try {
    const [players, attendanceRecords] = await Promise.all([
      getPlayers(filters),
      getAttendanceRecords({
        ...filters,
        date: filters.date || new Date().toISOString().slice(0, 10),
      }),
    ]);

    const present = attendanceRecords.filter((entry) => entry.present).length;
    const sortedByPoints = [...players].sort(
      (a, b) => (+b.points || 0) - (+a.points || 0),
    );

    return {
      totalPlayers: players.length,
      todayAttendance: present,
      attendancePercentage: players.length
        ? Math.round((present / players.length) * 100)
        : 0,
      mostAttendedPlayer: sortedByPoints[0] || null,
      leastAttendedPlayer: sortedByPoints[sortedByPoints.length - 1] || null,
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to load reports summary.");
  }
}

export async function getAppSettings() {
  try {
    const settingsSnapshot = await getDoc(doc(db, COLLECTIONS.settings, "app"));

    if (!settingsSnapshot.exists()) {
      return null;
    }

    return {
      id: settingsSnapshot.id,
      ...settingsSnapshot.data(),
    };
  } catch (error) {
    throw createFirebaseError(error, "Unable to load app settings.");
  }
}

export async function updateAppSettings(settingsData) {
  try {
    const payload = cleanPayload({
      ...settingsData,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, COLLECTIONS.settings, "app"), payload, { merge: true });
    return { id: "app", ...settingsData };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update app settings.");
  }
}

export async function addGymExercise(data) {
  requireFields(data, ["sportId", "category", "gymProgram", "exerciseName", "exerciseType"]);

  try {
    const payload = cleanPayload({
      ...data,
      sportId: "gym",
      active: data.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, COLLECTIONS.gymExercises), payload);
    return { id: ref.id, ...data, active: payload.active };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add gym exercise.");
  }
}

export async function getGymExercises(filters = {}) {
  try {
    const constraints = [where("sportId", "==", "gym")];
    if (filters.gymProgram) constraints.push(where("gymProgram", "==", filters.gymProgram));
    if (filters.category) constraints.push(where("category", "==", filters.category));
    const snapshot = await getDocs(
      query(collection(db, COLLECTIONS.gymExercises), ...constraints),
    );
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw createFirebaseError(error, "Unable to load gym exercises.");
  }
}

export async function updateGymExercise(exerciseId, data) {
  requireFields({ exerciseId }, ["exerciseId"]);

  try {
    const payload = cleanPayload({ ...data, updatedAt: serverTimestamp() });
    await setDoc(
      doc(db, COLLECTIONS.gymExercises, String(exerciseId)),
      payload,
      { merge: true },
    );
    return { id: String(exerciseId), ...data };
  } catch (error) {
    throw createFirebaseError(error, "Unable to update gym exercise.");
  }
}

export async function deleteGymExercise(exerciseId) {
  requireFields({ exerciseId }, ["exerciseId"]);

  try {
    await deleteDoc(doc(db, COLLECTIONS.gymExercises, String(exerciseId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete gym exercise.");
  }
}

export async function getGymPrograms() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.gymPrograms));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw createFirebaseError(error, "Unable to load gym programs.");
  }
}

export async function addGymProgram(data) {
  requireFields(data, ["name"]);
  try {
    const payload = cleanPayload({ ...data, active: data.active ?? true, createdAt: serverTimestamp() });
    const ref = await addDoc(collection(db, COLLECTIONS.gymPrograms), payload);
    return { id: ref.id, ...data, active: payload.active };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add gym program.");
  }
}

export async function deleteGymProgram(programId) {
  requireFields({ programId }, ["programId"]);
  try {
    await deleteDoc(doc(db, COLLECTIONS.gymPrograms, String(programId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete gym program.");
  }
}

export async function getGymExerciseTemplates() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.gymExerciseTemplates));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    throw createFirebaseError(error, "Unable to load gym exercise templates.");
  }
}

export async function addGymExerciseTemplate(data) {
  requireFields(data, ["title"]);
  try {
    const payload = cleanPayload({
      ...data,
      active: data.active ?? true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, COLLECTIONS.gymExerciseTemplates), payload);
    return { id: ref.id, ...data, active: payload.active };
  } catch (error) {
    throw createFirebaseError(error, "Unable to add gym exercise template.");
  }
}

export async function deleteGymExerciseTemplate(templateId) {
  requireFields({ templateId }, ["templateId"]);
  try {
    await deleteDoc(doc(db, COLLECTIONS.gymExerciseTemplates, String(templateId)));
    return true;
  } catch (error) {
    throw createFirebaseError(error, "Unable to delete gym exercise template.");
  }
}
