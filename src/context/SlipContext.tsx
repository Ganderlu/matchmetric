"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SlipEntry } from "@/types/slip";

interface SlipContextValue {
  entries: SlipEntry[];
  addEntry: (entry: SlipEntry) => void;
  removeEntry: (fixtureId: string) => void;
  hasEntry: (fixtureId: string) => boolean;
  count: number;
  isOpen: boolean;
  openSlip: () => void;
  closeSlip: () => void;
}

const SlipContext = createContext<SlipContextValue | null>(null);

export function SlipProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SlipEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addEntry = useCallback((entry: SlipEntry) => {
    setEntries((current) => {
      if (current.some((item) => item.fixtureId === entry.fixtureId)) return current;
      return [...current, entry];
    });
  }, []);

  const removeEntry = useCallback((fixtureId: string) => {
    setEntries((current) => current.filter((item) => item.fixtureId !== fixtureId));
  }, []);

  const hasEntry = useCallback((fixtureId: string) => entries.some((item) => item.fixtureId === fixtureId), [entries]);

  const openSlip = useCallback(() => setIsOpen(true), []);
  const closeSlip = useCallback(() => setIsOpen(false), []);

  const value = useMemo<SlipContextValue>(
    () => ({ entries, addEntry, removeEntry, hasEntry, count: entries.length, isOpen, openSlip, closeSlip }),
    [entries, addEntry, removeEntry, hasEntry, isOpen, openSlip, closeSlip],
  );

  return <SlipContext.Provider value={value}>{children}</SlipContext.Provider>;
}

export function useSlip() {
  const context = useContext(SlipContext);
  if (!context) throw new Error("useSlip must be used within a SlipProvider.");
  return context;
}
