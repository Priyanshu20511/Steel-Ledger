import {
  useListOpeningStock,
  useImportOpeningStock,
  useSetOpeningStock,
  useListStockItems,
  OpeningStockEntry,
} from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, UploadCloud, Edit, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
const API_URL =
  import.meta.env.VITE_API_URL || "https://steel-ledger-api.onrender.com";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("dsms_token");

  const response = await fetch(`${API_URL}${path}`, {
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
export default function OpeningStock() {
  const { data: openingStock, isLoading } = useListOpeningStock();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Opening Stock</h2>
          <p className="text-muted-foreground">
            Manage opening stock records for inventory items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddOpeningStockDialog />
          <ImportOpeningStockDialog />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Effective Date</TableHead>
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
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : openingStock?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No opening stock records found.
                  </TableCell>
                </TableRow>
              ) : (
                openingStock?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-primary">
                      {entry.stockItem?.itemCode}
                    </TableCell>

                    <TableCell>{entry.stockItem?.category}</TableCell>

                    <TableCell>{entry.stockItem?.size}</TableCell>

                    <TableCell className="text-right font-mono">
                      {entry.quantity.toLocaleString()} {entry.stockItem?.unit}
                    </TableCell>

                    <TableCell>
                      {format(new Date(entry.effectiveDate), "PPP")}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <EditOpeningStockDialog entry={entry} />

                        <DeleteOpeningStockDialog id={entry.id} />
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
const openingStockFormSchema = z.object({
  stockItemId: z.string().min(1, "Required"),
  quantity: z.coerce.number().min(0.001, "Must be greater than 0"),
});
function AddOpeningStockDialog() {
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const { data: stockItems } = useListStockItems();
  const createMutation = useSetOpeningStock();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof openingStockFormSchema>>({
    resolver: zodResolver(openingStockFormSchema),
    defaultValues: {
      stockItemId: "",
      quantity: 0,
    },
  });
  const onSubmit = async (data: z.infer<typeof openingStockFormSchema>) => {
    try {
      await createMutation.mutateAsync({
        data: {
          stockItemId: parseInt(data.stockItemId),
          quantity: data.quantity,
          effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
        },
      });

      queryClient.invalidateQueries();

      toast({
        title: "Opening stock added",
      });

      form.reset();

      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Opening Stock</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Opening Stock</DialogTitle>
          <DialogDescription>
            Create a new opening stock record.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>

                  <FormControl>
                    <Input type="number" step="0.001" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Effective Date</label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(effectiveDate, "PPP")}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={(d) => d && setEffectiveDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
function EditOpeningStockDialog({ entry }: { entry: OpeningStockEntry }) {
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date(entry.effectiveDate),
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      quantity: entry.quantity,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { quantity: number }) =>
      apiRequest(`/api/opening-stock/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: data.quantity,
          effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
        }),
      }),
  });

  const onSubmit = async (data: { quantity: number }) => {
    try {
      await updateMutation.mutateAsync(data);

      toast({
        title: "Opening stock updated",
      });

      queryClient.invalidateQueries();

      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Failed to update",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Opening Stock</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Stock Item</label>

              <Input value={entry.stockItem?.itemCode ?? ""} disabled />
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>

                  <FormControl>
                    <Input type="number" step="0.001" {...field} />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Effective Date</label>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(effectiveDate, "PPP")}
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={(d) => d && setEffectiveDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              Save
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
function DeleteOpeningStockDialog({ id }: { id: number }) {
  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/opening-stock/${id}`, {
        method: "DELETE",
      }),
  });

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync();

      toast({
        title: "Opening stock deleted",
      });

      queryClient.invalidateQueries();

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
          <DialogTitle>Delete Opening Stock</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p>Are you sure you want to delete this opening stock record?</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function ImportOpeningStockDialog() {
  const [open, setOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [csvContent, setCsvContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const importMutation = useImportOpeningStock();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;

    // Simple CSV parser
    const lines = csvContent.split("\n").filter((line) => line.trim());
    if (lines.length <= 1) {
      toast({
        title: "Error",
        description: "CSV seems empty",
        variant: "destructive",
      });
      return;
    }

    const rows = lines
      .slice(1)
      .map((line) => {
        const [itemCode, quantityStr] = line.split(",");
        return {
          itemCode: itemCode?.trim(),
          quantity: parseFloat(quantityStr?.trim() || "0"),
        };
      })
      .filter((r) => r.itemCode && !isNaN(r.quantity));

    try {
      const result = await importMutation.mutateAsync({
        data: {
          effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
          rows,
        },
      });

      toast({
        title: "Import Successful",
        description: `Imported ${result.imported} items. Skipped ${result.skipped}.`,
      });
      setOpen(false);
      setCsvContent("");
    } catch (e: any) {
      toast({
        title: "Import Failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <UploadCloud className="mr-2 h-4 w-4" /> Import Opening Stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Opening Stock</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: <strong>itemCode, quantity</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Effective Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(effectiveDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={effectiveDate}
                  onSelect={(d) => d && setEffectiveDate(d)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <Input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>

          {csvContent && (
            <div className="rounded-md bg-muted p-4 text-xs font-mono max-h-40 overflow-auto">
              {csvContent.split("\n").slice(0, 5).join("\n")}
              {csvContent.split("\n").length > 5 && "\n..."}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!csvContent || importMutation.isPending}
          >
            {importMutation.isPending ? "Importing..." : "Process Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
