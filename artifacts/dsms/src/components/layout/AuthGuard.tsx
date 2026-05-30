import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { ReactNode, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children, adminOnly = false }: { children: ReactNode, adminOnly?: boolean }) {
  const { user, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    } else if (!isLoading && user && adminOnly && user.role !== "admin") {
      setLocation("/");
    }
  }, [token, isLoading, setLocation, user, adminOnly]);

  if (isLoading || !token) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (adminOnly && user?.role !== "admin") {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;}