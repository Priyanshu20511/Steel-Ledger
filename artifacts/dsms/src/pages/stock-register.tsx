import {
  useGetStockRegister,
  getGetStockRegisterQueryKey,
  useListCategories,
} from "@workspace/api-client-react";
import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Printer, Download } from "lucide-react";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function StockRegister() {
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<string>("all");

  const dateStr = format(date, "yyyy-MM-dd");

  const { data: categories } = useListCategories();
  const { data: register, isLoading } = useGetStockRegister(
    {
      date: dateStr,
      category: category === "all" ? undefined : category,
    },
    {
      query: {
        queryKey: getGetStockRegisterQueryKey({
          date: dateStr,
          category: category === "all" ? undefined : category,
        }),
      },
    },
  );

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  const totals = register?.reduce(
    (acc, row) => ({
      opening: acc.opening + row.openingStock,
      production: acc.production + row.production,
      dispatch: acc.dispatch + row.dispatch,
      closing: acc.closing + row.closingStock,
    }),
    { opening: 0, production: 0, dispatch: 0, closing: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Register</h2>
          <p className="text-muted-foreground">
            Daily stock position across all items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b print:border-none print:pb-0">
          <div className="flex flex-col gap-4 sm:flex-row items-center justify-between print:hidden">
            <div className="flex gap-2 w-full sm:w-auto">
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

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="hidden print:block text-center pb-4">
            <h1 className="text-2xl font-bold">DSMS Stock Register</h1>
            <p className="text-sm">Date: {format(date, "PPP")}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-0">
            <Table>
              <TableHeader className="bg-muted/80 sticky top-0">
                <TableRow>
                  <TableHead className="font-semibold text-slate-800 dark:text-slate-200">
                    Item Code
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 dark:text-slate-200">
                    Category
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 dark:text-slate-200">
                    Size
                  </TableHead>
                  <TableHead className="font-semibold text-slate-800 dark:text-slate-200">
                    Length
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 border-x">
                    Opening
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-800 dark:text-slate-200 text-emerald-700 dark:text-emerald-500">
                    Production
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-800 dark:text-slate-200 text-orange-700 dark:text-orange-500 border-r">
                    Dispatch
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-800 dark:text-slate-200 bg-primary/5 border-l">
                    Closing
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(10)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                ) : register?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No stock data found for the selected date.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {register?.map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-slate-600 dark:text-slate-300">
                          {row.itemCode}
                        </TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.size}</TableCell>
                        <TableCell>{row.length}</TableCell>
                        <TableCell className="text-right font-mono text-sm bg-slate-50/50 dark:bg-slate-900/50 border-x">
                          {row.openingStock.toLocaleString()}{" "}
                          <span className="text-xs text-muted-foreground">
                            {row.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                          {row.production > 0
                            ? `+${row.production.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-orange-600 dark:text-orange-400 border-r">
                          {row.dispatch > 0
                            ? `-${row.dispatch.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm font-semibold bg-primary/5 border-l",
                            row.closingStock === 0
                              ? "text-destructive"
                              : "text-primary",
                          )}
                        >
                          {row.closingStock.toLocaleString()}{" "}
                          <span className="text-xs opacity-50">{row.unit}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted font-bold hover:bg-muted">
                      <TableCell
                        colSpan={4}
                        className="text-right uppercase tracking-wider text-xs"
                      >
                        Total
                      </TableCell>
                      <TableCell className="text-right font-mono border-x">
                        {totals?.opening.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {totals?.production.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600 dark:text-orange-400 border-r">
                        {totals?.dispatch.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary bg-primary/10 border-l">
                        {totals?.closing.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
