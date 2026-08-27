import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export function ThemeToggle({ lightText }: { lightText?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`inline-flex items-center justify-center p-2 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${
        lightText 
          ? "text-white/90 hover:text-white hover:bg-white/10" 
          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
      }`}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 dark:hidden" />
      <Moon className="h-5 w-5 hidden dark:block" />
    </button>
  );
}
