"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Globe, Phone, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

import { globalApi, getApiErrorMessage } from "@/lib/api";
import type { School } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

export default function GlobalVerificationPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      const data = await globalApi.listPendingSchools();
      setSchools(data || []);
    } catch (error) {
      toast({
        title: "Error fetching schools",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPending();
  }, []);

  const handleVerify = async (schoolId: string, status: "VERIFIED" | "REJECTED") => {
    setProcessingId(schoolId);
    try {
      await globalApi.verifySchool(schoolId, status);
      toast({
        title: status === "VERIFIED" ? "School approved" : "School rejected",
        description: `The institution has been successfully ${status.toLowerCase()}.`,
      });
      setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    } catch (error) {
      toast({
        title: "Action failed",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Institutional verification</h1>
        </div>
        <p className="text-sm text-on-surface-variant">
          Review and authorize new school registrations. Verify institutional identification before approval.
        </p>
      </div>

      {schools.length === 0 ? (
        <Card className="sanctuary-card flex h-64 flex-col items-center justify-center border-none !bg-surface-container-low text-center shadow-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary mb-4">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">All caught up</CardTitle>
          <p className="mt-1 text-sm text-on-surface-variant">No pending school registrations to verify.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Card key={school.id} className="sanctuary-card group flex flex-col overflow-hidden transition-all hover:shadow-sanctuary-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="rounded-lg bg-surface-container-high text-[10px] uppercase tracking-wider">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </Badge>
                </div>
                <CardTitle className="mt-4 line-clamp-1 text-lg">{school.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                <div className="space-y-2 rounded-xl bg-surface-container-low p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Registry ID:</span>
                    <span className="font-mono font-medium text-primary">{school.official_identifier || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Phone:</span>
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="h-3 w-3" />
                      {school.contact_phone || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleVerify(school.id, "VERIFIED")}
                    disabled={processingId === school.id}
                    className="flex-1 rounded-xl shadow-sanctuary"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleVerify(school.id, "REJECTED")}
                    disabled={processingId === school.id}
                    className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
