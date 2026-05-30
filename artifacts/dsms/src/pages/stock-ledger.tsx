import { 
  useGetStockLedger,
  useListStockItems,
  getGetStockLedgerQueryKey,
  useImportOpeningStock
} from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { format, subDays } from "date-fns";
import { FileUp, Search, CalendarIcon, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function StockLedger() {
  const [stockItemId, setStockItemId] = useState<string>("");
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  
  const fromDateStr = format(fromDate, "yyyy-MM-dd");
  const toDateStr = format(toDate, "yyyy-MM-dd");

  const { data: stockItems } = useListStockItems();
  
  const { data: ledger, isLoading } = useGetStockLedger({
    query: {
      enabled: !!stockItemId,
      queryKey: getGetStockLedgerQueryKey({
        stockItemId: parseInt(stockItemId),
        fromDate: fromDateStr,
        toDate: toDateStr
      })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Ledger</h2>
          <p className="text-muted-foreground">View detailed stock movement history for individual items.</p>
        </div>
        <ImportOpeningStockDialog />
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-4 sm:flex-row items-center">
            <Select value={stockItemId} onValueChange={setStockItemId}>
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select a stock item" />
              </SelectTrigger>
              <SelectContent>
                {stockItems?.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.itemCode} - {item.category} ({item.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(fromDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fromDate} onSelect={(d) => d && setFromDate(d)} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(toDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={toDate} onSelect={(d) => d && setToDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!stockItemId ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mb-4 text-muted-foreground/50" />
              <p>Select a stock item to view its ledger</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right text-emerald-600">Production (In)</TableHead>
                  <TableHead className="text-right text-orange-600">Dispatch (Out)</TableHead>
                  <TableHead className="text-right font-semibold">Closing Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : ledger?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No movement found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger?.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{format(new Date(row.date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right font-mono bg-slate-50 dark:bg-slate-900/50">{row.openingStock.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {row.production > 0 ? `+${row.production.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {row.dispatch > 0 ? `-${row.dispatch.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold bg-primary/5">
                        {row.closingStock.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
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
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
      toast({ title: "Error", description: "CSV seems empty", variant: "destructive" });
      return;
    }

    const rows = lines.slice(1).map(line => {
      const [itemCode, quantityStr] = line.split(',');
      return {
        itemCode: itemCode?.trim(),
        quantity: parseFloat(quantityStr?.trim() || "0")
      };
    }).filter(r => r.itemCode && !isNaN(r.quantity));

    try {
      const result = await importMutation.mutateAsync({
        data: {
          effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
          rows
        }
      });
      
      toast({ 
        title: "Import Successful", 
        description: `Imported ${result.imported} items. Skipped ${result.skipped}.`
      });
      setOpen(false);
      setCsvContent("");
    } catch (e: any) {
      toast({ title: "Import Failed", description: e.message, variant: "destructive" });
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
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(effectiveDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={effectiveDate} onSelect={(d) => d && setEffectiveDate(d)} />
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
              {csvContent.split('\n').slice(0, 5).join('\n')}
              {csvContent.split('\n').length > 5 && '\n...'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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