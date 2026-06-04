import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useListStockItems } from "@workspace/api-client-react";
import type { StockItem } from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, CalendarIcon, Search } from "lucide-react";

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

type OutMode = "sale" | "purchase-return" | "issue-production";

type BaseEntry = {
  id: number;
  date: string;
  stockItemId: number;
  quantity: number;
  baseRate?: number | string | null;
  remarks?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  stockItem?: StockItem | null;
};

type PartyEntry = BaseEntry & {
  partyName: string;
  invoiceNumber?: string | null;
  vehicleNumber?: string | null;
};

type IssueProductionEntry = BaseEntry;
type OutEntry = PartyEntry | IssueProductionEntry;

const modeConfig: Record<
  OutMode,
  {
    label: string;
    endpoint: string;
    tableTitle: string;
    description: string;
    requiresParty: boolean;
  }
> = {
  sale: {
    label: "Sale",
    endpoint: "/api/sale",
    tableTitle: "Sale Entries",
    description: "Manage daily sale entries.",
    requiresParty: true,
  },
  "purchase-return": {
    label: "Purchase Return",
    endpoint: "/api/purchase-return",
    tableTitle: "Purchase Return Entries",
    description: "Manage daily purchase return entries.",
    requiresParty: true,
  },
  "issue-production": {
    label: "Issue to Production",
    endpoint: "/api/issue-production",
    tableTitle: "Issue to Production Entries",
    description: "Manage raw material issued to production.",
    requiresParty: false,
  },
};

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

const formSchema = z.object({
  stockItemId: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0.01, "Must be greater than 0"),
  baseRate: baseRateSchema,
  partyName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  remarks: z.string().optional(),
});

export default function Dispatch() {
  const [mode, setMode] = useState<OutMode>("sale");
  const [date, setDate] = useState<Date>(new Date());
  const [partySearch, setPartySearch] = useState("");
  const dateStr = format(date, "yyyy-MM-dd");
  const config = modeConfig[mode];

  const query = useQuery({
    queryKey: ["stock-out", mode, dateStr, partySearch],
    queryFn: () =>
      apiRequest<OutEntry[]>(
        `${config.endpoint}?date=${dateStr}${config.requiresParty && partySearch ? `&partyName=${encodeURIComponent(partySearch)}` : ""}`,
      ),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dispatch</h2>
          <p className="text-muted-foreground">
            Manage sale, purchase return, and issue to production entries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
          {(Object.keys(modeConfig) as OutMode[]).map((key) => (
            <StockOutDialog
              key={key}
              mode={key}
              currentDate={dateStr}
              triggerLabel={modeConfig[key].label}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(modeConfig) as OutMode[]).map((key) => (
            <Button
              key={key}
              variant={mode === key ? "default" : "outline"}
              onClick={() => setMode(key)}
              className="min-w-[150px]"
            >
              {modeConfig[key].label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center justify-start md:justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-[240px] justify-start text-left font-normal")}
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
          {config.requiresParty && (
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by Party Name..."
                className="pl-8"
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{config.tableTitle}</h3>
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Item Code</TableHead>
                {config.requiresParty && <TableHead>Party Name</TableHead>}
                {config.requiresParty && (
                  <TableHead>Vehicle / Invoice</TableHead>
                )}
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Base Rate</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      {config.requiresParty && (
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                      )}
                      {config.requiresParty && (
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      )}
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
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : !query.data?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={config.requiresParty ? 7 : 5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No {config.label.toLowerCase()} entries found.
                  </TableCell>
                </TableRow>
              ) : (
                query.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-primary">
                      {entry.stockItem?.itemCode}
                      <div className="text-xs font-normal text-muted-foreground">
                        {entry.stockItem?.category} - {entry.stockItem?.size}
                      </div>
                    </TableCell>
                    {config.requiresParty && (
                      <TableCell>{(entry as PartyEntry).partyName}</TableCell>
                    )}
                    {config.requiresParty && (
                      <TableCell>
                        {(entry as PartyEntry).vehicleNumber && (
                          <div>Veh: {(entry as PartyEntry).vehicleNumber}</div>
                        )}
                        {(entry as PartyEntry).invoiceNumber && (
                          <div className="text-muted-foreground text-xs">
                            Inv: {(entry as PartyEntry).invoiceNumber}
                          </div>
                        )}
                        {!(entry as PartyEntry).vehicleNumber &&
                          !(entry as PartyEntry).invoiceNumber &&
                          "-"}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono text-orange-600 font-medium">
                      -{entry.quantity.toLocaleString()} {entry.stockItem?.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBaseRate(entry.baseRate)}
                    </TableCell>
                    <TableCell>{entry.remarks || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <StockOutDialog
                          mode={mode}
                          entry={entry}
                          currentDate={dateStr}
                        />
                        <DeleteStockOutDialog mode={mode} id={entry.id} />
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

function StockOutDialog({
  mode,
  entry,
  currentDate,
  triggerLabel,
}: {
  mode: OutMode;
  entry?: OutEntry;
  currentDate: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const config = modeConfig[mode];

  const { data: stockItems } = useListStockItems(
    { status: "active" },
    { query: { queryKey: ["stockItems", "active"] } },
  );
  const { data: parties = [] } = useQuery({
    queryKey: ["parties"],
    queryFn: async () => {
      const token = localStorage.getItem("dsms_token");

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/party-master`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load parties");
      }

      return response.json();
    },
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stockItemId: entry?.stockItemId?.toString() || "",
      quantity: entry?.quantity || 0,
      baseRate: entry?.baseRate != null ? String(entry.baseRate) : "",
      partyName: config.requiresParty
        ? (entry as PartyEntry | undefined)?.partyName || ""
        : "",
      invoiceNumber: config.requiresParty
        ? (entry as PartyEntry | undefined)?.invoiceNumber || ""
        : "",
      vehicleNumber: config.requiresParty
        ? (entry as PartyEntry | undefined)?.vehicleNumber || ""
        : "",
      remarks: entry?.remarks || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (config.requiresParty && !data.partyName?.trim()) {
        throw new Error("Party name is required");
      }

      const payload = {
        stockItemId: parseInt(data.stockItemId),
        quantity: data.quantity,
        baseRate: toApiBaseRate(data.baseRate),
        remarks: data.remarks,
        ...(config.requiresParty
          ? {
              partyName: data.partyName,
              invoiceNumber: data.invoiceNumber,
              vehicleNumber: data.vehicleNumber,
            }
          : {}),
      };

      if (!entry) {
        await apiRequest(config.endpoint, {
          method: "POST",
          body: JSON.stringify({ date: currentDate, ...payload }),
        });
        toast({ title: `${config.label} entry added` });
      } else {
        await apiRequest(`${config.endpoint}/${entry.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast({ title: `${config.label} entry updated` });
      }

      await queryClient.invalidateQueries({ queryKey: ["stock-out"] });
      setOpen(false);
      if (!entry) form.reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const label = entry ? `Edit ${config.label}` : `Add ${config.label}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {!entry ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />{" "}
            {triggerLabel ?? `Add ${config.label}`}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!entry && (
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

            {config.requiresParty && (
              <>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice No. (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle No. (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
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
              <Button type="submit">
                {entry ? "Save Changes" : "Save Entry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStockOutDialog({ mode, id }: { mode: OutMode; id: number }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const config = modeConfig[mode];

  const onDelete = async () => {
    try {
      await apiRequest(`${config.endpoint}/${id}`, { method: "DELETE" });
      toast({ title: "Entry deleted successfully" });
      await queryClient.invalidateQueries({ queryKey: ["stock-out"] });
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
            Are you sure you want to delete this entry? This action cannot be
            undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
