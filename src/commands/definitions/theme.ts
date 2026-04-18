import { updateTheme } from "../../store/configStore";
import type { Command } from "../types";

const setThemeLightCommand: Command = {
  id: "theme-light",
  label: "Set Theme: Light",
  description: "Switch to light theme",
  category: "theme",
  execute: async () => {
    updateTheme("light");
  },
};

const setThemeDarkCommand: Command = {
  id: "theme-dark",
  label: "Set Theme: Dark",
  description: "Switch to dark theme",
  category: "theme",
  execute: async () => {
    updateTheme("dark");
  },
};

const setThemeSystemCommand: Command = {
  id: "theme-system",
  label: "Set Theme: System",
  description: "Use system theme preference",
  category: "theme",
  execute: async () => {
    updateTheme("system");
  },
};

export const themeCommands: Command[] = [
  setThemeLightCommand,
  setThemeDarkCommand,
  setThemeSystemCommand,
];
