import { redirect } from "next/navigation";

export default function ConsumablesPage() {
  redirect("/admin/compras?vista=consumibles");
}
