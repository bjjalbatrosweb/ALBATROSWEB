import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type OrderByDirection,
  type Query,
  type SetOptions,
  type UpdateData,
  type WhereFilterOp,
} from 'firebase-admin/firestore';

type QueryConstraint = (query: Query) => Query;

export { Timestamp };

export function collection(db: Firestore, path: string) {
  return db.collection(path);
}

export function doc(db: Firestore, collectionPath: string, id: string) {
  return db.collection(collectionPath).doc(id);
}

export function where(
  field: string,
  operator: WhereFilterOp,
  value: unknown,
): QueryConstraint {
  return (queryRef) => queryRef.where(field, operator, value);
}

export function orderBy(
  field: string,
  direction: OrderByDirection = 'asc',
): QueryConstraint {
  return (queryRef) => queryRef.orderBy(field, direction);
}

export function limit(value: number): QueryConstraint {
  return (queryRef) => queryRef.limit(value);
}

export function query(
  baseQuery: Query,
  ...constraints: QueryConstraint[]
): Query {
  return constraints.reduce(
    (currentQuery, constraint) => constraint(currentQuery),
    baseQuery,
  );
}

export function getDocs(queryRef: Query) {
  return queryRef.get();
}

export async function getDoc(reference: DocumentReference) {
  const snapshot = await reference.get();

  return {
    id: snapshot.id,
    exists: () => snapshot.exists,
    data: () => snapshot.data(),
  };
}

export function addDoc(
  collectionRef: CollectionReference,
  data: DocumentData,
) {
  return collectionRef.add(data);
}

export function setDoc(
  reference: DocumentReference,
  data: DocumentData,
  options?: SetOptions,
) {
  return options ? reference.set(data, options) : reference.set(data);
}

export function updateDoc(
  reference: DocumentReference,
  data: UpdateData<DocumentData>,
) {
  return reference.update(data);
}

export function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

export function arrayUnion(...values: unknown[]) {
  return FieldValue.arrayUnion(...values);
}
