"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dark = theme === "dark"
  const next = dark ? "light" : "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setTheme(next)}
          aria-label={`Switch to ${next} theme`}
          className="flex items-center gap-2 px-2.5 h-8 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          {mounted ? (
            dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />
          ) : (
            <Sun className="size-3.5 opacity-0" />
          )}
          <span className="font-mono uppercase tracking-wider text-[10px]">
            {mounted ? (dark ? "Dark" : "Light") : ""}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Switch to {next} theme</TooltipContent>
    </Tooltip>
  )
}
