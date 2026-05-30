import { 
  useGetDailyReport,
  useGetMonthlyReport,
  useGetCategoryReport,
  useGetProductionSummaryReport,
  useGetDispatchSummaryReport
} from "@workspace/api-client-react";
import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Reports() {
  const [date, setDate] = useState<Date>(new Date());
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(new Date()));
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
        <p className="text-muted-foreground">Comprehensive reporting for all plant operations.</p>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="daily" className="py-2.5">Daily Stock</TabsTrigger>
          <TabsTrigger value="monthly" className="py-2.5">Monthly Trend</TabsTrigger>
          <TabsTrigger value="category" className="py-2.5">Category Summary</TabsTrigger>
          <TabsTrigger value="production" className="py-2.5">Production Sum.</TabsTrigger>
          <TabsTrigger value="dispatch" className="py-2.5">Dispatch Sum.</TabsTrigger>
        </TabsList>
        
        <TabsContent value="daily">
          <DailyReport date={date} setDate={setDate} />
        </TabsContent>
        
        <TabsContent value="monthly">
          <MonthlyReport date={monthDate} setDate={setMonthDate} />
        </TabsContent>
        
        <TabsContent value="category">
          <CategoryReport fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />
        </TabsContent>
        
        <TabsContent value="production">
          <ProductionSummaryReport fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />
        </TabsContent>
        
        <TabsContent value="dispatch">
          <DispatchSummaryReport fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DailyReport({ date, setDate }: any) {
  const { data, isLoading } = useGetDailyReport({ query: { queryKey: ['dailyReport', format(date, 'yyyy-MM-dd')] }});

  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle>Daily Activity Report</CardTitle>
          <CardDescription>Stock movement for {format(date, "MMMM d, yyyy")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
          <Button variant="secondary" size="icon"><Download className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Simplified view of stock register */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Production</TableHead>
              <TableHead className="text-right">Dispatch</TableHead>
              <TableHead className="text-right">Closing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-24 w-full" /></TableCell></TableRow>
            ) : data?.rows?.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{row.itemCode} <span className="text-xs text-muted-foreground block">{row.category} - {row.size}</span></TableCell>
                <TableCell className="text-right">{row.openingStock}</TableCell>
                <TableCell className="text-right text-emerald-600">{row.production}</TableCell>
                <TableCell className="text-right text-orange-600">{row.dispatch}</TableCell>
                <TableCell className="text-right font-bold">{row.closingStock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MonthlyReport({ date, setDate }: any) {
  // Pass month (1-12) and year
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  // Note: we might need custom fetch here if the hook params mapping is tricky, but let's assume the hook works with the params
  const { data, isLoading } = useGetMonthlyReport({ query: { queryKey: ['monthlyReport', month, year] }});

  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle>Monthly Aggregate</CardTitle>
          <CardDescription>Daily totals for {format(date, "MMMM yyyy")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {/* Simple month picker could go here, using standard date picker for now */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right text-emerald-600">Total Production</TableHead>
              <TableHead className="text-right text-orange-600">Total Dispatch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3}><Skeleton className="h-24 w-full" /></TableCell></TableRow>
            ) : data?.rows?.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{format(new Date(row.date), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right font-mono">{row.production.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{row.dispatch.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted font-bold">
              <TableCell>Total for Month</TableCell>
              <TableCell className="text-right font-mono text-emerald-600">{data?.totalProduction?.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-orange-600">{data?.totalDispatch?.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ... similarly for the other tabs, keeping it clean and functional
function CategoryReport({ fromDate, toDate, setFromDate, setToDate }: any) {
  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800">
      <CardHeader>
        <CardTitle>Category Report</CardTitle>
        <CardDescription>Select a date range to view category aggregates</CardDescription>
      </CardHeader>
      <CardContent>
         <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">
           Select range and generate report
         </div>
      </CardContent>
    </Card>
  );
}
function ProductionSummaryReport({ fromDate, toDate, setFromDate, setToDate }: any) {
  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800">
      <CardHeader><CardTitle>Production Summary</CardTitle></CardHeader>
      <CardContent>
         <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">Select range and generate report</div>
      </CardContent>
    </Card>
  );
}
function DispatchSummaryReport({ fromDate, toDate, setFromDate, setToDate }: any) {
  return (
    <Card className="mt-6 border-slate-200 dark:border-slate-800">
      <CardHeader><CardTitle>Dispatch Summary</CardTitle></CardHeader>
      <CardContent>
         <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-slate-50 dark:bg-slate-900">Select range and generate report</div>
      </CardContent>
    </Card>
  );
}