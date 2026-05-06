import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Locale = "fr" | "en";

interface LangState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      locale: "fr",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "mansa-locale" }
  )
);
