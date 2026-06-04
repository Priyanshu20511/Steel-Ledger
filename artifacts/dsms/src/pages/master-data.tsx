import {
  useListStockItems,
  useCreateStockItem,
  useUpdateStockItem,
  useDeleteStockItem,
  useListCategories,
  getListStockItemsQueryKey,
  StockItem,
} from "@workspace/api-client-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Edit, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function StockMaster() {
  const [partySearch, setPartySearch] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("stock");

  const { data: stockItems, isLoading } = useListStockItems({
    query: {
      queryKey: getListStockItemsQueryKey({
        search: search || undefined,
        category: category === "all" ? undefined : category,
      }),
    },
  });
  const { data: categories } = useListCategories();
  const { data: parties = [] } = useQuery({
    queryKey: ["party-master"],
    queryFn: async () => {
      const token = localStorage.getItem("dsms_token");

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/party-master`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load parties");
      }

      return response.json();
    },
  });
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="stock">Stock Master</TabsTrigger>

        <TabsTrigger value="party">Party Master</TabsTrigger>
      </TabsList>
      <TabsContent value="stock">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Stock Master
              </h2>
              <p className="text-muted-foreground">
                Manage all your steel/iron products, categories, and
                specifications.
              </p>
            </div>
            <StockItemDialog mode="create" />
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col gap-4 sm:flex-row items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, size..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full sm:w-[180px]">
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
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Item Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Size Diff.</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
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
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-12" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                  ) : stockItems?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No stock items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockItems?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-primary">
                          {item.itemCode}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.size}</TableCell>
                        <TableCell>{item.sizeDiff || "-"}</TableCell>
                        <TableCell>{item.length}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "active" ? "default" : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <StockItemDialog mode="edit" item={item} />
                            <DeleteStockItemDialog
                              id={item.id}
                              code={item.itemCode}
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
      </TabsContent>

      {/*Party Master*/}
      <TabsContent value="party">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Party Master
              </h2>
              <p className="text-muted-foreground">
                Manage customers and suppliers.
              </p>
            </div>

            <PartyDialog />
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parties..."
                  className="pl-8"
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>GST No</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {parties.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No parties found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parties.map((party: any) => (
                      <TableRow key={party.id}>
                        <TableCell>{party.name}</TableCell>
                        <TableCell>{party.gstNo || "-"}</TableCell>
                        <TableCell>{party.phone || "-"}</TableCell>
                        <TableCell>{party.address || "-"}</TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <PartyDialog mode="edit" party={party} />
                            <DeletePartyDialog
                              id={party.id}
                              name={party.name}
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
      </TabsContent>
    </Tabs>
  );
}

const formSchema = z.object({
  category: z.string().min(1, "Required"),
  size: z.string().min(1, "Required"),
  sizeDiff: z.string().optional(),
  length: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  status: z.enum(["active", "inactive"]).default("active"),
});
const partyFormSchema = z.object({
  name: z.string().min(1, "Required"),
  gstNo: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
type Party = {
  id: number;
  name: string;
  gstNo: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
};

function StockItemDialog({
  mode,
  item,
}: {
  mode: "create" | "edit";
  item?: StockItem;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateStockItem();
  const updateMutation = useUpdateStockItem();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: item?.category || "",
      size: item?.size || "",
      sizeDiff: item?.sizeDiff || "",
      length: item?.length || "",
      unit: item?.unit || "KG",
      status: item?.status || "active",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (mode === "create") {
        console.log("STOCK DATA", data);
        await createMutation.mutateAsync({ data });
        toast({ title: "Stock item created" });
      } else if (item) {
        await updateMutation.mutateAsync({
          id: item.id,
          data,
        });
        toast({ title: "Stock item updated" });
      }
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
      setOpen(false);
      form.reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Item
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
              ? "Add New Stock Item"
              : `Edit ${item?.itemCode}`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. TMT Bar, Angle..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 10mm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sizeDiff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size Diff.</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. +2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Length</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 12m" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="KG">KG</SelectItem>
                        <SelectItem value="MT">MT</SelectItem>
                        <SelectItem value="PCS">PCS</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {mode === "create" ? "Save Item" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
async function createParty(data: any) {
  // console.log("A - CREATE PARTY CALLED");

  const token = localStorage.getItem("dsms_token");

  // console.log("B - TOKEN", token);

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/party-master`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    },
  );

  // console.log("C - STATUS", response.status);

  return response.json();
}
async function updateParty(
  id: number,
  data: {
    name: string;
    gstNo?: string;
    phone?: string;
    address?: string;
  },
) {
  const token = localStorage.getItem("dsms_token");

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/party-master/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
async function deleteParty(id: number) {
  const token = localStorage.getItem("dsms_token");

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/party-master/${id}`,
    {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
function PartyDialog({
  mode = "create",
  party,
}: {
  mode?: "create" | "edit";
  party?: any;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof partyFormSchema>>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: {
      name: party?.name || "",
      gstNo: party?.gstNo || "",
      phone: party?.phone || "",
      address: party?.address || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof partyFormSchema>) => {
    try {
      if (mode === "create") {
        await createParty(data);

        toast({
          title: "Party created successfully",
        });
      } else if (party) {
        await updateParty(party.id, data);

        toast({
          title: "Party updated successfully",
        });
      }

      queryClient.invalidateQueries();

      setOpen(false);
      form.reset();
    } catch (e: any) {
      toast({
        title:
          mode === "create"
            ? "Failed to create party"
            : "Failed to update party",
        description: e.message,
        variant: "destructive",
      });

      console.error("PARTY ERROR", e);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Party
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
            {mode === "create" ? "Add Party" : "Edit Party"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Party Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gstNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST No</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit">Save Party</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
function DeletePartyDialog({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onDelete = async () => {
    try {
      await deleteParty(id);

      toast({
        title: "Party deleted successfully",
      });

      queryClient.invalidateQueries();

      setOpen(false);
    } catch (e: any) {
      toast({
        title: "Failed to delete party",
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
          <DialogTitle>Delete Party</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p>
            Are you sure you want to delete <strong>{name}</strong>?
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
function DeleteStockItemDialog({ id, code }: { id: number; code: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteStockItem();

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Item deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
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
          <DialogTitle>Delete Stock Item</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            Are you sure you want to delete <strong>{code}</strong>? This action
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
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
