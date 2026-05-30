import { 
  useGetStockSummary, 
  useGetLowStockItems, 
  useGetTopProducedItems, 
  useGetTopDispatchedItems,
  useGetMonthlyTrend,
  useGetCategoryBreakdown
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { PackageOpen, TrendingUp, TrendingDown, Layers, AlertTriangle, Box } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function Dashboard() {
  const today = new Date();
  
  const { data: summary, isLoading: loadingSummary } = useGetStockSummary();
  const { data: lowStock, isLoading: loadingLowStock } = useGetLowStockItems();
  const { data: topProduced, isLoading: loadingTopProduced } = useGetTopProducedItems();
  const { data: topDispatched, isLoading: loadingTopDispatched } = useGetTopDispatchedItems();
  const { data: monthlyTrend, isLoading: loadingTrend } = useGetMonthlyTrend();
  const { data: categoryBreakdown, isLoading: loadingCategories } = useGetCategoryBreakdown();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of stock operations for {format(today, "MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard 
          title="Total Opening" 
          value={summary?.totalOpeningStock ?? 0} 
          icon={PackageOpen}
          loading={loadingSummary}
        />
        <SummaryCard 
          title="Today's Production" 
          value={summary?.totalProduction ?? 0} 
          icon={TrendingUp}
          loading={loadingSummary}
          className="text-emerald-600 dark:text-emerald-500"
        />
        <SummaryCard 
          title="Today's Dispatch" 
          value={summary?.totalDispatch ?? 0} 
          icon={TrendingDown}
          loading={loadingSummary}
          className="text-orange-600 dark:text-orange-500"
        />
        <SummaryCard 
          title="Today's Closing" 
          value={summary?.totalClosingStock ?? 0} 
          icon={Layers}
          loading={loadingSummary}
          className="text-primary"
        />
        <SummaryCard 
          title="Total Items" 
          value={summary?.totalItems ?? 0} 
          icon={Box}
          loading={loadingSummary}
        />
        <SummaryCard 
          title="Low Stock Alerts" 
          value={summary?.lowStockCount ?? 0} 
          icon={AlertTriangle}
          loading={loadingSummary}
          className={(summary?.lowStockCount ?? 0) > 0 ? "text-destructive font-bold" : ""}
        />
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Production vs Dispatch (Last 12 Months)</CardTitle>
          <CardDescription>Monthly volume comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {loadingTrend ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="production" name="Production" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="dispatch" name="Dispatch" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Produced */}
        <Card>
          <CardHeader>
            <CardTitle>Top Produced Items (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTopProduced ? <Skeleton className="h-64" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Category/Size</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProduced?.length ? topProduced.map((item) => (
                    <TableRow key={item.stockItemId}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.category} - {item.size}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No production data this month.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Dispatched */}
        <Card>
          <CardHeader>
            <CardTitle>Top Dispatched Items (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTopDispatched ? <Skeleton className="h-64" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Category/Size</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDispatched?.length ? topDispatched.map((item) => (
                    <TableRow key={item.stockItemId}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.category} - {item.size}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No dispatch data this month.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Current Stock by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {loadingCategories ? <Skeleton className="h-full w-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="closingStock"
                      nameKey="category"
                    >
                      {categoryBreakdown?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLowStock ? <Skeleton className="h-64" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock?.length ? lowStock.map((item) => (
                    <TableRow key={item.stockItemId}>
                      <TableCell className="font-medium">{item.itemCode}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">
                        {item.currentStock.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        All stock levels are optimal.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, loading, className }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-2xl font-bold ${className || ""}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}