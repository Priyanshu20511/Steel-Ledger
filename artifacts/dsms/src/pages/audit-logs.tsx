import { 
  useListAuditLogs,
  useListUsers
} from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [userId, setUserId] = useState<string>("all");
  const [action, setAction] = useState<string>("all");

  const { data: users } = useListUsers();
  const { data: logs, isLoading } = useListAuditLogs({
    query: {
      queryKey: ['auditLogs', userId, action]
    }
  });

  const getActionColor = (act: string) => {
    if (act.includes('CREATE')) return 'default';
    if (act.includes('UPDATE')) return 'secondary';
    if (act.includes('DELETE')) return 'destructive';
    if (act.includes('LOGIN')) return 'outline';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground">System-wide activity tracking for accountability.</p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex gap-4">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Creates</SelectItem>
                <SelectItem value="UPDATE">Updates</SelectItem>
                <SelectItem value="DELETE">Deletes</SelectItem>
                <SelectItem value="LOGIN">Logins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : logs?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "dd-MM-yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium">{log.userName || `User #${log.userId}`}</TableCell>
                    <TableCell>
                      <Badge variant={getActionColor(log.action)} className="text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {log.newValue ? `Changed to: ${log.newValue}` : (log.oldValue || "-")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}