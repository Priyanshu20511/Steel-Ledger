import {
  useListProduction,
  useCreateProduction,
  useUpdateProduction,
  useDeleteProduction,
  useListStockItems,
  getListProductionQueryKey,
  ProductionEntry,
} from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, CalendarIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type EntryKind = "production" | "purchase" | "sale-return";

type StockInEntry = ProductionEntry & {
  entryKind: EntryKind;
  entryTypeLabel: string;
  partyName?: string | null;
  baseRate?: number | string | null;
};

const baseRateSchema = z
  .string()
  .optional()
  .refine((value) => !value || Number(value) > 0, "Must be greater than 0");

function toApiBaseRate(value?: string) {
  return value ? Number(value) : null;
}

function formatBaseRate(value: unknown) {
  if (value == null || value === "") return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "-";
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("dsms_token");
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const stockInQueryKey = (kind: EntryKind, date: string) => [kind, date];

export default function Production() {
  const [date, setDate] = useState<Date>(new Date());
  const [mode, setMode] = useState<EntryKind>("production");
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: productionEntries, isLoading: isProductionLoading } =
    useListProduction(
      { date: dateStr },
      {
        query: {
          queryKey: getListProductionQueryKey({ date: dateStr }),
        },
      },
    );

  const { data: purchaseEntries, isLoading: isPurchaseLoading } = useQuery({
    queryKey: stockInQueryKey("purchase", dateStr),
    queryFn: () => apiRequest<StockInEntry[]>(`/api/purchase?date=${dateStr}`),
  });

  const { data: saleReturnEntries, isLoading: isSaleReturnLoading } = useQuery({
    queryKey: stockInQueryKey("sale-return", dateStr),
    queryFn: () =>
      apiRequest<StockInEntry[]>(`/api/sale-return?date=${dateStr}`),
  });

  const isLoading =
    isProductionLoading || isPurchaseLoading || isSaleReturnLoading;
  const rows =
    mode === "production"
      ? (productionEntries ?? [])
      : mode === "purchase"
        ? (purchaseEntries ?? [])
        : (saleReturnEntries ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Production</h2>
          <p className="text-muted-foreground">
            Manage daily production entries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
          <ProductionDialog
            mode="create"
            entryKind="purchase"
            currentDate={dateStr}
            triggerLabel="Purchase"
            dialogTitle="Add Purchase Entry"
          />
          <ProductionDialog
            mode="create"
            entryKind="sale-return"
            currentDate={dateStr}
            triggerLabel="Sale Return"
            dialogTitle="Add Sale Return Entry"
          />
          <ProductionDialog
            mode="create"
            entryKind="production"
            currentDate={dateStr}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "production" ? "default" : "outline"}
            onClick={() => setMode("production")}
            className="min-w-[150px]"
          >
            Production
          </Button>

          <Button
            variant={mode === "purchase" ? "default" : "outline"}
            onClick={() => setMode("purchase")}
            className="min-w-[150px]"
          >
            Purchase
          </Button>

          <Button
            variant={mode === "sale-return" ? "default" : "outline"}
            onClick={() => setMode("sale-return")}
            className="min-w-[150px]"
          >
            Sale Return
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-4 sm:flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/*<div className="p-2 text-sm text-red-500">Current Mode: {mode}</div>*/}
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Category / Size</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No stock-in entries for this date.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((entry) => (
                  <TableRow key={`${entry.entryKind}-${entry.id}`}>
                    <TableCell>{entry.entryTypeLabel}</TableCell>
                    <TableCell className="font-medium text-primary">
                      {entry.stockItem?.itemCode}
                    </TableCell>
                    <TableCell>
                      {entry.stockItem?.category} - {entry.stockItem?.size}
                    </TableCell>
                    <TableCell>{entry.partyName || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 font-medium">
                      +{entry.quantity.toLocaleString()} {entry.stockItem?.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBaseRate(entry.baseRate)}
                    </TableCell>
                    <TableCell>{entry.remarks || "-"}</TableCell>
                    <TableCell>{entry.createdByName || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ProductionDialog
                          mode="edit"
                          entryKind={entry.entryKind}
                          entry={entry}
                          currentDate={dateStr}
                        />
                        <DeleteStockInDialog
                          id={entry.id}
                          entryKind={entry.entryKind}
                          currentDate={dateStr}
                        />
                      </div>
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

const formSchema = z.object({
  stockItemId: z.string().min(1, "Required"),
  partyName: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Must be greater than 0"),
  baseRate: baseRateSchema,
  remarks: z.string().optional(),
});

function ProductionDialog({
  mode,
  entryKind,
  entry,
  currentDate,
  triggerLabel = "Add Production",
  dialogTitle,
}: {
  mode: "create" | "edit";
  entryKind: EntryKind;
  entry?: StockInEntry;
  currentDate: string;
  triggerLabel?: string;
  dialogTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stockItems } = useListStockItems(undefined, {
    query: {
      queryKey: ["stockItems", "active"],
    },
  });
  const { data: parties = [] } = useQuery({
    queryKey: ["parties"],
    queryFn: async () => {
      const token = localStorage.getItem("dsms_token");

      const response = await fetch("/api/party-master", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load parties");
      }

      return response.json();
    },
  });

  const createMutation = useCreateProduction();
  const updateMutation = useUpdateProduction();
  const stockInMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const endpoint =
        entryKind === "purchase" ? "/api/purchase" : "/api/sale-return";
      const body = {
        date: currentDate,
        stockItemId: parseInt(data.stockItemId),
        partyName: data.partyName?.trim(),
        quantity: data.quantity,
        baseRate: toApiBaseRate(data.baseRate),
        remarks: data.remarks,
      };

      if (mode === "create") {
        return apiRequest(endpoint, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      return apiRequest(`${endpoint}/${entry!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          partyName: body.partyName,
          quantity: body.quantity,
          baseRate: body.baseRate,
          remarks: body.remarks,
        }),
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stockItemId: entry?.stockItemId?.toString() || "",
      partyName: entry?.partyName || "",
      quantity: entry?.quantity || 0,
      baseRate: entry?.baseRate != null ? String(entry.baseRate) : "",
      remarks: entry?.remarks || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (entryKind !== "production" && !data.partyName?.trim()) {
        form.setError("partyName", { message: "Party name is required" });
        return;
      }

      if (entryKind !== "production") {
        await stockInMutation.mutateAsync(data);
        toast({
          title: `${triggerLabel} entry ${mode === "create" ? "added" : "updated"}`,
        });
      } else if (mode === "create") {
        await createMutation.mutateAsync({
          data: {
            date: currentDate,
            stockItemId: parseInt(data.stockItemId),
            quantity: data.quantity,
            baseRate: toApiBaseRate(data.baseRate),
            remarks: data.remarks,
          },
        });
        toast({ title: "Production entry added" });
      } else if (entry) {
        await updateMutation.mutateAsync({
          params: { id: entry.id },
          data: {
            quantity: data.quantity,
            baseRate: toApiBaseRate(data.baseRate),
            remarks: data.remarks,
          },
        });
        toast({ title: "Production entry updated" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey() });
      queryClient.invalidateQueries({
        queryKey: stockInQueryKey("purchase", currentDate),
      });
      queryClient.invalidateQueries({
        queryKey: stockInQueryKey("sale-return", currentDate),
      });
      setOpen(false);
      if (mode === "create") form.reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {triggerLabel}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? (dialogTitle ?? "Add Production Entry")
              : "Edit Production"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === "create" && (
              <FormField
                control={form.control}
                name="stockItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Item</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stockItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.itemCode} - {item.category} ({item.size})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {entryKind !== "production" && (
              <FormField
                control={form.control}
                name="partyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party Name</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Party" />
                        </SelectTrigger>

                        <SelectContent>
                          {parties.map((party: any) => (
                            <SelectItem key={party.id} value={party.name}>
                              {party.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Rate (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      placeholder="e.g. 55000"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  stockInMutation.isPending
                }
              >
                {mode === "create" ? "Save Entry" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStockInDialog({
  id,
  entryKind,
  currentDate,
}: {
  id: number;
  entryKind: EntryKind;
  currentDate: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteProduction();
  const stockInDeleteMutation = useMutation({
    mutationFn: () => {
      const endpoint =
        entryKind === "purchase" ? "/api/purchase" : "/api/sale-return";
      return apiRequest(`${endpoint}/${id}`, { method: "DELETE" });
    },
  });

  const onDelete = async () => {
    try {
      if (entryKind === "production") {
        await deleteMutation.mutateAsync({ id });
      } else {
        await stockInDeleteMutation.mutateAsync();
      }
      toast({ title: "Entry deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey() });
      queryClient.invalidateQueries({
        queryKey: stockInQueryKey("purchase", currentDate),
      });
      queryClient.invalidateQueries({
        queryKey: stockInQueryKey("sale-return", currentDate),
      });
      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Failed to delete",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Entry</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete this production entry? This action
            cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={
              deleteMutation.isPending || stockInDeleteMutation.isPending
            }
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
