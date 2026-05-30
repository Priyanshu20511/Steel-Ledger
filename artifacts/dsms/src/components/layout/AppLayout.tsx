import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useLocation } from "wouter";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-muted/20 p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}