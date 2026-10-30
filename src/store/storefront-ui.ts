"use client";
import { create } from "zustand";

export const useStorefrontUI = create<{
  overlay: "cart" | "menu" | null;
  openCart: () => void;
  setOverlay: (overlay: "cart" | "menu" | null) => void;
}>(set => ({ overlay: null, openCart: () => set({ overlay: "cart" }), setOverlay: overlay => set({ overlay }) }));
