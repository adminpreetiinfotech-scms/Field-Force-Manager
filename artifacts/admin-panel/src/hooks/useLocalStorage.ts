import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/**
 * Generic localStorage-backed state hook.
 *
 * @param key           localStorage key
 * @param defaultValue  value to use when nothing is stored or parsing fails
 * @param fromStorage   optional function that converts the raw stored string back to T;
 *                      return `undefined` to fall back to defaultValue (useful for validation)
 * @param toStorage     optional function that serialises T to a string (defaults to String())
 *                      — intentionally kept out of the effect deps to avoid writes on every
 *                      render when the caller passes an inline arrow function
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  fromStorage: (stored: string) => T | undefined = (s) => s as unknown as T,
  toStorage: (value: T) => string = (v) => String(v),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      const parsed = fromStorage(stored);
      return parsed !== undefined ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const toStorageRef = useRef(toStorage);
  toStorageRef.current = toStorage;

  useEffect(() => {
    try {
      localStorage.setItem(key, toStorageRef.current(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}
