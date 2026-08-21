import { cn } from "@/lib/utils"
import Image from "next/image"

export function Logo({
  className,
  heading = true,
}: {
  className?: string
  heading?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Image
        src="/milogo.png"
        alt="Albatros Logo"
        width={40}
        height={40}
        className="h-auto w-auto"
      />
      {heading ? (
        <h1 className="font-headline text-2xl uppercase tracking-wider text-primary">
          ALBATROS
        </h1>
      ) : (
        <span className="font-headline text-2xl uppercase tracking-wider text-primary">
          ALBATROS
        </span>
      )}
    </div>
  )
}
