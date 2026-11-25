import { useCallback, useRef, useState, type SetStateAction } from "react";

/**
 * State that survives the wide ↔ phone layout switch.
 *
 * Rotating an iPad across the wide breakpoint, or folding/unfolding the iPhone
 * Duo, swaps a screen's wide component for its phone one (and back), which
 * unmounts the wide panes. The screen itself stays mounted, so it owns a
 * PaneMemory (usePaneMemory) and passes it down; the panes keep their
 * selection, mode and any half-written draft in it via useRememberedState,
 * and pick up where they were when the wide layout comes back.
 *
 * In memory only: it lasts as long as the screen that owns it.
 */
export type PaneMemory = Map<string, unknown>;

export function usePaneMemory(): PaneMemory {
  return useRef<PaneMemory>(new Map()).current;
}

/** useState whose value is mirrored into `memory` under `key`. */
export function useRememberedState<T>(
  memory: PaneMemory | undefined,
  key: string,
  initial: T | (() => T),
): [T, (next: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    if (memory?.has(key)) return memory.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const set = useCallback(
    (next: SetStateAction<T>) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        memory?.set(key, v);
        return v;
      }),
    [memory, key],
  );
  return [value, set];
}
