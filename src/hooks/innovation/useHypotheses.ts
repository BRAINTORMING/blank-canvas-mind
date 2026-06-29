import { useEffect, useState, useCallback } from "react";

export interface Hypothesis {
  id: string;
  name: string;
  objective: string;
  metrics: string[]; // metric keys: "wau", "retention_d7", "session_avg", "idt_avg", "nps"
  evidence: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  status: "Validándose" | "Perseverar" | "Pivotar" | "Riesgo";
  createdAt: string;
}

const KEY = "gdudex:innovation:hypotheses:v1";

function load(): Hypothesis[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: Hypothesis[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function useHypotheses() {
  const [list, setList] = useState<Hypothesis[]>(() => load());

  useEffect(() => {
    save(list);
  }, [list]);

  const add = useCallback((h: Omit<Hypothesis, "id" | "createdAt">) => {
    setList((prev) => [
      ...prev,
      { ...h, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
    ]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Hypothesis>) => {
    setList((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }, []);

  const remove = useCallback((id: string) => {
    setList((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { list, add, update, remove };
}
