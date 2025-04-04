import React from "react"
import { cn } from "@/lib/utils"

type SpinnerProps = {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  }

  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
} 