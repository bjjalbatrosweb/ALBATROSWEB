import { adminDb } from "@/lib/firebase-admin";
import { mergeStoreCatalog } from "@/lib/store-products";
export async function loadStoreCatalog(sede: string) {
 const snapshot = await adminDb.collection("InventarioTienda").where("sede", "==", sede).get();
 return mergeStoreCatalog(snapshot.docs.map(doc => doc.data()));
}
