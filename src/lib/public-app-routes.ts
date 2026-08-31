const PUBLIC_APP_ROUTE_PREFIXES = ["/foro"] as const;

/**
 * Routes that live inside the athlete app group but must remain available to
 * visitors. Matching complete path segments avoids accidentally exposing a
 * similarly named private route such as `/foro-interno`.
 */
export function isPublicAppRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  return PUBLIC_APP_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
