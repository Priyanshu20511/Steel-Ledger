import { 
  useListProduction,
  useCreateProduction,
  useUpdateProduction,
  useDeleteProduction,
  useListStockItems,
  getListProductionQueryKey,
  ProductionEntry
} from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, CalendarIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Production() {
  const [date, setDate] = useState<Date>(new Date());
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: productionEntries, isLoading } = useListProduction({
    query: {
      queryKey: getListProductionQueryKey({ date: dateStr })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Production</h2>
          <p className="text-muted-foreground">Manage daily production entries.</p>
        </div>
        <ProductionDialog mode="create" currentDate={dateStr} />
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-4 sm:flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Category / Size</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : productionEntries?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No production entries for this date.
                  </TableCell>
                </TableRow>
              ) : (
                productionEntries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-primary">{entry.stockItem?.itemCode}</TableCell>
                    <TableCell>{entry.stockItem?.category} - {entry.stockItem?.size}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600 font-medium">
                      +{entry.quantity.toLocaleString()} {entry.stockItem?.unit}
                    </TableCell>
                    <TableCell>{entry.remarks || "-"}</TableCell>
                    <TableCell>{entry.createdByName || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ProductionDialog mode="edit" entry={entry} currentDate={dateStr} />
                        <DeleteProductionDialog id={entry.id} />
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
  quantity: z.coerce.number().min(0.01, "Must be greater than 0"),
  remarks: z.string().optional(),
});

function ProductionDialog({ mode, entry, currentDate }: { mode: 'create' | 'edit', entry?: ProductionEntry, currentDate: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: stockItems } = useListStockItems({ query: { queryKey: ['stockItems', 'active'] }});
  
  const createMutation = useCreateProduction();
  const updateMutation = useUpdateProduction();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stockItemId: entry?.stockItemId?.toString() || "",
      quantity: entry?.quantity || 0,
      remarks: entry?.remarks || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync({ 
          data: {
            date: currentDate,
            stockItemId: parseInt(data.stockItemId),
            quantity: data.quantity,
            remarks: data.remarks
          }
        });
        toast({ title: "Production entry added" });
      } else if (entry) {
        await updateMutation.mutateAsync({ 
          params: { id: entry.id }, 
          data: {
            quantity: data.quantity,
            remarks: data.remarks
          } 
        });
        toast({ title: "Production entry updated" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey() });
      setOpen(false);
      if (mode === 'create') form.reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === 'create' ? (
          <Button><Plus className="mr-2 h-4 w-4" /> Add Production</Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Production Entry' : 'Edit Production'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === 'create' && (
              <FormField control={form.control} name="stockItemId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Item</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {stockItems?.map(item => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.itemCode} - {item.category} ({item.size})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks (Optional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {mode === 'create' ? 'Save Entry' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductionDialog({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteProduction();

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ params: { id } });
      toast({ title: "Entry deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getListProductionQueryKey() });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Entry</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Are you sure you want to delete this production entry? This action cannot be undone.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}