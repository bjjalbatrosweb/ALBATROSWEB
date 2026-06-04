/**
 * @file This file is deliberately left without a default export to resolve 
 * a Next.js parallel route conflict with /src/app/recompensas/page.tsx.
 * 
 * The active Rewards page is located at the root: src/app/recompensas/page.tsx
 * to remain public and independent, similar to the Forum.
 */

export const metadata = {
  title: 'Redirección de Recompensas',
};

export default function InactiveRewardsPage() {
  return null;
}
