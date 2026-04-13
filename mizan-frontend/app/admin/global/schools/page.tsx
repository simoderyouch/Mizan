"use client";

import { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  Building2, 
  CheckCircle2, 
  MoreHorizontal, 
  Search, 
  ShieldAlert, 
  Trash2, 
  XCircle 
} from "lucide-react";

import { globalApi, getApiErrorMessage } from "@/lib/api";
import type { School } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GlobalSchoolsPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSchools = async () => {
    try {
      const data = await globalApi.listSchools();
      setSchools(data || []);
    } catch (error) {
      toast({
        title: "Error fetching institutions",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSchools();
  }, []);

  const handleToggleActive = async (schoolId: string, currentStatus: string) => {
    const isCurrentlyActive = currentStatus === "VERIFIED";
    try {
      await globalApi.toggleSchoolActive(schoolId, !isCurrentlyActive);
      toast({
        title: isCurrentlyActive ? "Institution suspended" : "Institution activated",
        description: `Operational status has been updated.`,
      });
      void fetchSchools();
    } catch (error) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await globalApi.deleteSchool(deletingId);
      toast({
        title: "Institution removed",
        description: "The school and associated data have been deleted.",
      });
      setSchools(prev => prev.filter(s => s.id !== deletingId));
    } catch (error) {
      toast({
        title: "Deletion failed",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.official_identifier?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institutional management</h1>
          <p className="text-sm text-on-surface-variant">Full oversight and administrative control of registered schools.</p>
        </div>
        <div className="relative w-full max-w-sm sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant opacity-50" />
          <Input
            placeholder="Search schools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-none bg-surface-container-low pl-9 shadow-sm focus-visible:ring-primary/20"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-surface-container-high hover:bg-transparent">
                <TableHead className="w-[300px] text-[10px] font-bold uppercase tracking-wider">Institution</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Registry ID</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Contact</TableHead>
                <TableHead className="w-[80px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-on-surface-variant">
                    No institutions found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchools.map((school) => (
                  <TableRow key={school.id} className="border-surface-container-low hover:bg-surface-container-low/50">
                    <TableCell className="py-4">
                       <div className="flex items-center gap-3">
                         <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                           <Building2 className="h-5 w-5" />
                         </div>
                         <span className="font-bold text-on-surface">{school.name}</span>
                       </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">{school.official_identifier || "—"}</TableCell>
                    <TableCell>
                       <Badge 
                         className="rounded-lg border-none capitalize"
                         variant={
                           school.verification_status === "VERIFIED" ? "secondary" : 
                           school.verification_status === "PENDING" ? "warning" : "destructive"
                         }
                       >
                         {school.verification_status.toLowerCase()}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-on-surface-variant">
                      {school.contact_phone || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] rounded-xl border-none bg-surface-container-high p-1 shadow-sanctuary-lg">
                          <DropdownMenuItem 
                            onClick={() => handleToggleActive(school.id, school.verification_status)}
                            className="gap-2 rounded-lg py-2 focus:bg-primary/5 focus:text-primary"
                          >
                             {school.verification_status === "VERIFIED" ? (
                               <>
                                 <XCircle className="h-4 w-4" />
                                 <span>Suspend Institution</span>
                               </>
                             ) : (
                               <>
                                 <CheckCircle2 className="h-4 w-4" />
                                 <span>Activate Institution</span>
                               </>
                             )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                             onClick={() => setDeletingId(school.id)}
                             className="gap-2 rounded-lg py-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                             <Trash2 className="h-4 w-4" />
                             <span>Remove Data</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingId} onOpenChange={(open: boolean) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-2xl border-none bg-surface-container-lowest shadow-sanctuary-lg max-w-md">
          <AlertDialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold">Absolute Removal</AlertDialogTitle>
            <AlertDialogDescription className="text-on-surface-variant">
              This will permanently delete the institution and all associated data. This action is irreversible and should be used with extreme caution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-none bg-surface-container-low hover:bg-surface-container-high transition-colors">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-sanctuary"
            >
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
