'use client';

import { AppSidebar, AppSidebarSkeleton } from "@/components/layout/sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DailyDataProvider } from "@/context/DailyDataProvider";
import { ClientOnly } from "@/components/client-only";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/logo";
import { AthleteMobileNav } from "@/components/athlete/athlete-mobile-nav";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
  type Sede,
} from "@/lib/access-control";
import { isPublicAppRoute } from "@/lib/public-app-routes";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen bg-background">
        <AppSidebarSkeleton />
        <div className="flex-1 p-4 md:p-8 space-y-8">
            <header>
                <Skeleton className="h-9 w-1/3" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </header>
            <div className="space-y-8">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[200px] w-full" />
            </div>
        </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = isPublicAppRoute(pathname);
  const [isRoleReady, setIsRoleReady] = useState(false);

  useEffect(() => {
    if (isPublicRoute) {
      setIsRoleReady(true);
      return;
    }

    if (isUserLoading) return;

    if (!user) {
      setIsRoleReady(false);
      router.replace('/login');
      return;
    }

    let cancelled = false;

    const verificarRol = async () => {
      try {
        const snapshot = await getDoc(doc(firestore, "usuarios", user.uid));
        const perfil = snapshot.exists()
          ? normalizarPerfilAcceso(snapshot.data())
          : null;

        if (
          perfil?.activo &&
          (perfil.rol === "admin" || perfil.rol === "profesor")
        ) {
          const sedeGuardada = localStorage.getItem("userSede") as Sede | null;
          const sedePermitida =
            sedeGuardada && puedeAdministrarSede(perfil, sedeGuardada)
              ? sedeGuardada
              : perfil.sede !== "TODAS" && perfil.sede
                ? perfil.sede
                : perfil.sedes?.[0] || "MMA";

          localStorage.setItem("userSede", sedePermitida);
          localStorage.setItem("userRole", perfil.rol);
          router.replace("/admin/dashboard");
          return;
        }

        if (perfil?.activo && perfil.rol === "atleta" && perfil.alumnoId) {
          localStorage.removeItem("userSede");
          localStorage.setItem("userRole", "atleta");
          if (!cancelled) setIsRoleReady(true);
          return;
        }

        localStorage.removeItem("userSede");
        localStorage.removeItem("userRole");
        await signOut(auth);
        router.replace("/login");
      } catch {
        localStorage.removeItem("userSede");
        localStorage.removeItem("userRole");
        await signOut(auth);
        router.replace("/login");
      }
    };

    void verificarRol();

    return () => {
      cancelled = true;
    };
  }, [auth, firestore, user, isUserLoading, isPublicRoute, router]);

  if (isPublicRoute) {
    return <div className="min-h-screen bg-white text-slate-950">{children}</div>;
  }

  if (isUserLoading || !user || !isRoleReady) {
    return <div className="dark"><FullPageLoader /></div>;
  }
  
  return (
    <div className="dark">
      <DailyDataProvider>
        <SidebarProvider>
          <ClientOnly fallback={<AppSidebarSkeleton />}>
            <AppSidebar />
          </ClientOnly>
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/90 backdrop-blur-sm px-4 md:hidden">
              <Logo />
              <SidebarTrigger className="text-primary" />
            </header>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
            <AthleteMobileNav />
          </SidebarInset>
        </SidebarProvider>
      </DailyDataProvider>
    </div>
  );
}
