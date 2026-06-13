
'use client';

import React from 'react';
import { Toaster } from "@/components/ui/toaster";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground font-body">
      {children}
      <Toaster />
    </div>
  );
}
