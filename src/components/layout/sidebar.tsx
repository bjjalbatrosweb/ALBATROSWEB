
"use client";

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Flame,
  FlaskConical,
  Cpu,
  BookCopy,
  User,
  LogOut,
  Loader2,
  AppWindow,
  Award,
  Dices,
  MessageSquare,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';

const menuGroups = [
  {
    label: 'Rendimiento',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/laboratorio', label: 'Laboratorio', icon: FlaskConical },
      { href: '/bitacora', label: 'Bitácora', icon: BookCopy },
    ],
  },
  {
    label: 'Nutrición',
    items: [
      { href: '/alimentos', label: 'Alimentos', icon: Flame },
      { href: '/chef-ia', label: 'Chef IA', icon: Cpu },
    ],
  },
  {
    label: 'Academia',
    items: [
      { href: '/foro', label: 'Foro', icon: MessageSquare },
      { href: '/dados', label: 'Dados', icon: Dices },
      { href: '/recompensas', label: 'Recompensas', icon: Award },
      { href: '/apps', label: 'Apps', icon: AppWindow },
    ],
  },
];
const menuItems = menuGroups.flatMap((group) => group.items);

const profileItem = { href: '/perfil', label: 'Perfil Guerrero', icon: User };
const logoutItem = { href: '/login', label: 'Cerrar Sesión', icon: LogOut };

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleLogout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      localStorage.removeItem('userSede');
      await signOut(auth);
      router.replace('/login');
      router.refresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo cerrar la sesión',
        description:
          error instanceof Error
            ? error.message
            : 'Inténtalo nuevamente.',
      });
      setIsSigningOut(false);
    }
  }

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
              {group.label}
            </p>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={{ children: item.label }}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
         <SidebarGroup>
            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
              Cuenta
            </p>
            <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(profileItem.href)}
                    tooltip={{ children: profileItem.label }}
                  >
                    <Link href={profileItem.href}>
                      <profileItem.icon />
                      <span>{profileItem.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={{ children: logoutItem.label }}
                    disabled={isSigningOut}
                  >
                    <Link
                      href={logoutItem.href}
                      onClick={handleLogout}
                      aria-busy={isSigningOut}
                    >
                        {isSigningOut ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <logoutItem.icon />
                        )}
                        <span>
                          {isSigningOut ? 'Cerrando...' : logoutItem.label}
                        </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
         </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}


export function AppSidebarSkeleton() {
  return (
    <div
      className="group peer hidden md:block text-sidebar-foreground"
      data-state="expanded" 
      data-variant="sidebar"
      data-side="left"
    >
      <div
        className={cn(
          "duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear"
        )}
      />
      <div
        className={cn(
          "duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex",
          "left-0",
          "border-r" 
        )}
      >
        <div
          data-sidebar="sidebar"
          className="flex h-full w-full flex-col bg-sidebar"
        >
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {[...Array(menuItems.length)].map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border">
            <SidebarGroup>
                <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
          </SidebarFooter>
        </div>
      </div>
    </div>
  );
}
