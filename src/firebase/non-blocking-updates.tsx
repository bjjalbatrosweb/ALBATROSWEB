"use client";

import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  DocumentData,
  SetOptions,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  reportFirebaseAvailable,
  reportFirebaseFailure,
} from "@/lib/firebase-health";

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(
  docRef: DocumentReference,
  data: DocumentData,
  options: SetOptions,
) {
  setDoc(docRef, data, options)
    .then(() => reportFirebaseAvailable("escritura"))
    .catch((error) => {
      reportFirebaseFailure(error, "escritura");
      if (error?.code !== "permission-denied") {
        console.error("Firestore set failed:", error);
        return;
      }
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: docRef.path,
          operation: "write", // or 'create'/'update' based on options
          requestResourceData: data,
        }),
      );
    });
  // Execution continues immediately
}

/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(
  colRef: CollectionReference,
  data: DocumentData,
) {
  const promise = addDoc(colRef, data)
    .then((reference) => {
      reportFirebaseAvailable("escritura");
      return reference;
    })
    .catch((error) => {
      reportFirebaseFailure(error, "escritura");
      if (error?.code !== "permission-denied") {
        console.error("Firestore add failed:", error);
        return;
      }
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: colRef.path,
          operation: "create",
          requestResourceData: data,
        }),
      );
    });
  return promise;
}

/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(
  docRef: DocumentReference,
  data: DocumentData,
) {
  updateDoc(docRef, data)
    .then(() => reportFirebaseAvailable("escritura"))
    .catch((error) => {
      reportFirebaseFailure(error, "escritura");
      if (error?.code !== "permission-denied") {
        console.error("Firestore update failed:", error);
        return;
      }
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: data,
        }),
      );
    });
}

/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .then(() => reportFirebaseAvailable("escritura"))
    .catch((error) => {
      reportFirebaseFailure(error, "escritura");
      if (error?.code !== "permission-denied") {
        console.error("Firestore delete failed:", error);
        return;
      }
      errorEmitter.emit(
        "permission-error",
        new FirestorePermissionError({
          path: docRef.path,
          operation: "delete",
        }),
      );
    });
}
