import { useAuth } from "@/contexts/AuthContext";
import { useLogout, useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Bell, Moon, Sun, LogOut, ShieldAlert, Package, Info, Truck } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

export function Header() {
  const { user, logout: contextLogout } = useAuth();
  const { theme, setTheme } = useTheme();
  const logoutMutation = useLogout();
  const { data: notifications } = useListNotifications({ query: { refetchInterval: 30000 } });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      // Ignore
    } finally {
      contextLogout();
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return <Package className="h-4 w-4 text-orange-500" />;
      case 'backup_failed': return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'large_dispatch': return <Truck className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-card px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          D
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground hidden sm:inline-block">
          DSMS <span className="font-normal text-muted-foreground text-sm ml-2 hidden md:inline-block">Dasmesh Stock Management System</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="font-semibold">Notifications</h4>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-0 text-xs text-primary"
                  onClick={() => markAllRead.mutate()}
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <ScrollArea className="h-80">
              {notifications && notifications.length > 0 ? (
                <div className="flex flex-col">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`flex items-start gap-3 border-b p-4 text-sm transition-colors ${n.isRead ? 'opacity-60' : 'bg-muted/30'}`}
                    >
                      <div className="mt-0.5 rounded-full bg-background p-1.5 border shadow-sm">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium leading-none">{n.message}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                      </div>
                      {!n.isRead && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => markRead.mutate({ params: { id: n.id } })}
                        >
                          <span className="sr-only">Mark as read</span>
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.username}
                </p>
                <div className="pt-1.5">
                  <Badge variant="outline" className="text-xs capitalize">
                    {user?.role}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}