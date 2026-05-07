import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const phone = localStorage.getItem("sa_phone");
    if (phone) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      if (location !== "/login") {
        setLocation("/login");
      }
    }
  }, [location, setLocation]);

  return { isAuthenticated };
}
