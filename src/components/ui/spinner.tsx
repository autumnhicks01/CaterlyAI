import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const spinnerVariants = cva(
  "inline-block animate-spin rounded-full border-current border-solid border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]",
  {
    variants: {
      size: {
        default: "h-5 w-5 border-2",
        sm: "h-4 w-4 border-2",
        lg: "h-8 w-8 border-3",
        xl: "h-12 w-12 border-4",
      },
      variant: {
        default: "text-foreground/70",
        primary: "text-primary",
        secondary: "text-secondary-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement>, 
  Omit<VariantProps<typeof spinnerVariants>, keyof React.HTMLAttributes<HTMLDivElement>> {}

export function Spinner({ className, size, variant, ...props }: SpinnerProps & { variant?: "default" | "primary" | "secondary" }) {
  return (
    <div 
      className={cn(spinnerVariants({ size, variant }), className)} 
      role="status" 
      aria-label="Loading"
      {...props}
    />
  )
} 