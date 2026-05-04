import { useState, useEffect } from "react";

export interface User {
  id: string;
  phone: string;
  name: string;
  role: "admin" | "super_admin" | "staff" | string;
  companyName?: string | null;
}

const listeners = new Set<(user: User | null) => void>();

const getStoredUser = (): User | null => {
  try {
    const item = localStorage.getItem("admin_user");
    if (item) return JSON.parse(item);
  } catch (e) {
    console.error("Failed to parse user from localStorage", e);
  }
  return null;
};

let currentUser = getStoredUser();

export const useAuth = () => {
  const [user, setUserState] = useState<User | null>(currentUser);

  useEffect(() => {
    listeners.add(setUserState);
    return () => {
      listeners.delete(setUserState);
    };
  }, []);

  const setUser = (newUser: User | null) => {
    if (newUser) {
      localStorage.setItem("admin_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("admin_user");
    }
    currentUser = newUser;
    listeners.forEach((listener) => listener(newUser));
  };

  const logout = () => {
    localStorage.removeItem("admin_user");
    currentUser = null;
    listeners.forEach((listener) => listener(null));
  };

  return { user, setUser, logout };
};
