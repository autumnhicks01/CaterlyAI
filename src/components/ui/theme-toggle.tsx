"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full w-9 h-9 border-purple-500/30 hover:border-purple-500/70 dark:border-purple-400/30 dark:hover:border-purple-400/70 bg-white/80 dark:bg-gray-900/80"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all text-amber-500 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all text-purple-400 dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="mt-2">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-secondary text-primary" : ""}
        >
          <Sun className="h-4 w-4 mr-2 text-amber-500" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-secondary text-primary" : ""}
        >
          <Moon className="h-4 w-4 mr-2 text-purple-400" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className={theme === "system" ? "bg-secondary text-primary" : ""}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 mr-2 text-gray-500"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 