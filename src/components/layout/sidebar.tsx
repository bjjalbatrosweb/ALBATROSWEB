"use client";

import * as React from 'react';
import { usePathname } from 'next/navigation';
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
  AppWindow,
  Award,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useAuth } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import type { AuthError } from 'firebase/auth';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alimentos', label: 'Alimentos', icon: Flame },
  { href: '/laboratorio', label: 'Laboratorio', icon: FlaskConical },
  { href: '/chef-ia', label: 'Chef IA', icon: Cpu },
  { href: '/bitacora', label: 'Bitácora', icon: BookCopy },
  { href: '/recompensas', label: 'Recompensas', icon: Award },
  { href: '/apps', label: 'Apps', icon: AppWindow },
];

const profileItem = { href: '/perfil', label: 'Perfil Guerrero', icon: User };
const logoutItem = { href: '/login', label: 'Cerrar Sesión', icon: LogOut };

export function AppSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const { toast } = useToast();

  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    initiateSignOut(auth, (error: AuthError) => {
      toast({
        variant: "destructive",
        title: "Error al Cerrar Sesión",
        description: error.message,
      });
    });
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
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
         <SidebarGroup>
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
                  >
                    <Link href={logoutItem.href} onClick={handleLogout}>
                        <logoutItem.icon />
                        <span>{logoutItem.label}</span>
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
  // Directly return the skeleton structure without using the <Sidebar> component
  // to avoid calling useSidebar() on the server, which causes a server-render error.
  return (
    <div
      className="group peer hidden md:block text-sidebar-foreground"
      data-state="expanded" // Assume expanded for skeleton
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
          "border-r" // Directly apply border for sidebar variant
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
