import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agenda tu clase de prueba | Albatros",
  description: "Reserva tu primera clase en Albatros MMA y elige disciplina y horario.",
};

export default function TrialClassLayout({ children }: { children: React.ReactNode }) {
  return children;
}
