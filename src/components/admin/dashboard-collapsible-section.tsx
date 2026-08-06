'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type DashboardCollapsibleSectionProps = {
  id: string;
  title: string;
  description: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  compactHeader?: boolean;
  children: ReactNode;
};

export function DashboardCollapsibleSection({
  id,
  title,
  description,
  expanded,
  onToggle,
  trailing,
  compactHeader = false,
  children,
}: DashboardCollapsibleSectionProps) {
  return (
    <Card className="overflow-hidden border-primary/10 bg-card/40">
      <CardHeader className="border-b border-primary/10 bg-secondary/15 p-0">
        <button
          type="button"
          className={cn(
            'group flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
            compactHeader && 'pb-4',
          )}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={onToggle}
        >
          <div>
            <CardTitle className="text-sm font-black uppercase italic tracking-wide">{title}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">{description}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {trailing}
            <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/10 bg-background/50 text-muted-foreground transition-colors group-hover:text-foreground">
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-300 ease-out', expanded && 'rotate-180')} />
            </span>
          </div>
        </button>
      </CardHeader>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </Card>
  );
}
