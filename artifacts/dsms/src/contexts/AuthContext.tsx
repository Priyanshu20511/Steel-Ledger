import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { initApi } from "@/lib/api";

initApi();

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("dsms_token"));
  const [user, setUser] = useState<User | null>(null);

  const { data: meData, isLoading: isLoadingMe, error, isError } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (meData) {
      setUser(meData);
    }
  }, [meData]);

  useEffect(() => {
    if (isError) {
      // Token might be invalid
      localStorage.removeItem("dsms_token");
      setToken(null);
      setUser(null);
    }
  }, [isError]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("dsms_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("dsms_token");
    setToken(null);
    setUser(null);
  };

  const isLoading = !!token && isLoadingMe;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
