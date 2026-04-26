import { useState, useEffect } from "react";

const LS_KEY = "spotd-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(LS_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // Spot'd defaults to dark — only follow system if it's also dark
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem(LS_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => t === "dark" ? "light" : "dark");
  };

  return { theme, toggleTheme };
}