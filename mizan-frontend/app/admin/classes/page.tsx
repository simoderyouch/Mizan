"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Loader2, MoreHorizontal, Plus, RefreshCw, Search, Upload, Users } from "lucide-react";

import { authApi, getApiErrorMessage, institutionalApi } from "@/lib/api";
import type { Class, CurrentUser, Filiere, Promotion, School } from "@/lib/admin-types";
import { EmptyState, ErrorState } from "@/components/admin/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

type CreateTab = "filiere" | "promotion" | "class";

const CREATE_TAB_VALUES: CreateTab[] = ["filiere", "promotion", "class"];

export default function AdminClassesPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [, setCurrentUser] = useState<CurrentUser | null>(null);

  const [schools, setSchools] = useState<School[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedFiliereId, setSelectedFiliereId] = useState("");
  const [selectedPromotionId, setSelectedPromotionId] = useState("");

  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [filieresLoading, setFilieresLoading] = useState(false);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const [activeCreateTab, setActiveCreateTab] = useState<CreateTab>("class");
  const [creating, setCreating] = useState<CreateTab | null>(null);

  const [filiereForm, setFiliereForm] = useState({ name: "" });
  const [promotionForm, setPromotionForm] = useState({ name: "", filiere_id: "" });
  const [classForm, setClassForm] = useState({ name: "", promotion_id: "", academic_year: `${currentYear}-${currentYear + 1}` });

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) ?? null,
    [schools, selectedSchoolId]
  );
  const selectedFiliere = useMemo(
    () => filieres.find((filiere) => filiere.id === selectedFiliereId) ?? null,
    [filieres, selectedFiliereId]
  );
  const selectedPromotion = useMemo(
    () => promotions.find((promotion) => promotion.id === selectedPromotionId) ?? null,
    [promotions, selectedPromotionId]
  );

  const loadSchoolsAndSession = useCallback(async () => {
    setBootstrapLoading(true);
    setError("");
    try {
      const [schoolsResponse, me] = await Promise.all([institutionalApi.listSchools(), authApi.me()]);
      setCurrentUser(me);
      setSchools(schoolsResponse);

      const nextSchoolId = me.school_id ?? schoolsResponse[0]?.id ?? "";
      setSelectedSchoolId(nextSchoolId);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load schools and admin scope."));
    } finally {
      setBootstrapLoading(false);
    }
  }, []);

  const loadFilieres = useCallback(async (schoolId: string) => {
    if (!schoolId) {
      setFilieres([]);
      setSelectedFiliereId("");
      setPromotions([]);
      setSelectedPromotionId("");
      setClasses([]);
      return;
    }

    setFilieresLoading(true);
    setError("");
    try {
      const filieresResponse = await institutionalApi.listFilieresBySchool(schoolId);
      setFilieres(filieresResponse);
      const nextFiliere = filieresResponse[0]?.id ?? "";
      setSelectedFiliereId(nextFiliere);
      setPromotionForm((prev) => ({ ...prev, filiere_id: nextFiliere }));
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load filieres."));
      setFilieres([]);
      setSelectedFiliereId("");
      setPromotions([]);
      setSelectedPromotionId("");
      setClasses([]);
    } finally {
      setFilieresLoading(false);
    }
  }, []);

  const loadPromotions = useCallback(async (filiereId: string) => {
    if (!filiereId) {
      setPromotions([]);
      setSelectedPromotionId("");
      setClasses([]);
      return;
    }

    setPromotionsLoading(true);
    setError("");
    try {
      const promotionsResponse = await institutionalApi.listPromotionsByFiliere(filiereId);
      setPromotions(promotionsResponse);
      const nextPromotion = promotionsResponse[0]?.id ?? "";
      setSelectedPromotionId(nextPromotion);
      setPromotionForm((prev) => ({ ...prev, filiere_id: filiereId }));
      setClassForm((prev) => ({ ...prev, promotion_id: nextPromotion }));
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load promotions."));
      setPromotions([]);
      setSelectedPromotionId("");
      setClasses([]);
    } finally {
      setPromotionsLoading(false);
    }
  }, []);

  const loadClasses = useCallback(async (promotionId: string) => {
    if (!promotionId) {
      setClasses([]);
      return;
    }

    setClassesLoading(true);
    setError("");
    try {
      const classesResponse = await institutionalApi.listClassesByPromotion(promotionId);
      setClasses(classesResponse);
      setClassForm((prev) => ({ ...prev, promotion_id: promotionId }));
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load classes."));
      setClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, []);

  const refreshCurrentScope = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      await loadSchoolsAndSession();
    } finally {
      setRefreshing(false);
    }
  }, [loadSchoolsAndSession]);

  useEffect(() => {
    void loadSchoolsAndSession();
  }, [loadSchoolsAndSession]);

  useEffect(() => {
    if (!selectedSchoolId) return;
    void loadFilieres(selectedSchoolId);
  }, [selectedSchoolId, loadFilieres]);

  useEffect(() => {
    if (!selectedFiliereId) return;
    void loadPromotions(selectedFiliereId);
  }, [selectedFiliereId, loadPromotions]);

  useEffect(() => {
    if (!selectedPromotionId) return;
    void loadClasses(selectedPromotionId);
  }, [selectedPromotionId, loadClasses]);

  useEffect(() => {
    const requestedTab = searchParams.get("create");
    if (requestedTab && CREATE_TAB_VALUES.includes(requestedTab as CreateTab)) {
      setActiveCreateTab(requestedTab as CreateTab);
    }
  }, [searchParams]);

  const handleCreateFiliere = async (event: FormEvent) => {
    event.preventDefault();
    const name = filiereForm.name.trim();
    const schoolId = selectedSchoolId;

    if (!name || !schoolId) {
      toast({ title: "Validation error", description: "Filiere name is required.", variant: "destructive" });
      return;
    }

    setCreating("filiere");
    try {
      const created = await institutionalApi.createFiliere({
        name,
        school_id: schoolId,
      });
      setFiliereForm((prev) => ({ ...prev, name: "" }));
      if (schoolId === selectedSchoolId) {
        await loadFilieres(selectedSchoolId);
        setSelectedFiliereId(created.id);
      }
      toast({ title: "Filiere created", description: `${created.name} was added successfully.` });
    } catch (createError: unknown) {
      toast({
        title: "Filiere creation failed",
        description: getApiErrorMessage(createError, "Unable to create filiere."),
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreatePromotion = async (event: FormEvent) => {
    event.preventDefault();
    const name = promotionForm.name.trim();
    const filiereId = promotionForm.filiere_id || selectedFiliereId;

    if (!name || !filiereId) {
      toast({ title: "Validation error", description: "Promotion name and filiere are required.", variant: "destructive" });
      return;
    }

    setCreating("promotion");
    try {
      const created = await institutionalApi.createPromotion({
        name,
        filiere_id: filiereId,
      });
      setPromotionForm((prev) => ({ ...prev, name: "" }));
      if (filiereId === selectedFiliereId) {
        await loadPromotions(selectedFiliereId);
        setSelectedPromotionId(created.id);
      }
      toast({ title: "Promotion created", description: `${created.name} was added successfully.` });
    } catch (createError: unknown) {
      toast({
        title: "Promotion creation failed",
        description: getApiErrorMessage(createError, "Unable to create promotion."),
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreateClass = async (event: FormEvent) => {
    event.preventDefault();
    const name = classForm.name.trim();
    const promotionId = classForm.promotion_id || selectedPromotionId;
    const academicYear = classForm.academic_year.trim();

    if (!name || !promotionId || !academicYear) {
      toast({
        title: "Validation error",
        description: "Class name, promotion, and academic year are required.",
        variant: "destructive",
      });
      return;
    }

    setCreating("class");
    try {
      await institutionalApi.createClass({
        name,
        promotion_id: promotionId,
        academic_year: academicYear,
      });
      setClassForm((prev) => ({ ...prev, name: "" }));
      if (promotionId === selectedPromotionId) {
        await loadClasses(selectedPromotionId);
      }
      toast({ title: "Class created", description: `${name} was added successfully.` });
    } catch (createError: unknown) {
      toast({
        title: "Class creation failed",
        description: getApiErrorMessage(createError, "Unable to create class."),
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">Academy</h1>
          <p className="mt-2 text-base text-on-surface-variant">Configure institutional structure and manage academic content.</p>
        </div>
        <Button variant="ghost" onClick={() => void refreshCurrentScope()} disabled={bootstrapLoading || refreshing} className="rounded-xl border-none bg-surface-container-low shadow-sm transition-all hover:bg-surface-container-high text-primary">
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </header>

      {error ? <ErrorState message={error} onRetry={() => void refreshCurrentScope()} /> : null}

      <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-on-surface">Hierarchy filters</CardTitle>
        </CardHeader>
        <CardContent>
          {bootstrapLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Skeleton className="h-[72px] rounded-2xl bg-surface-container-low" />
              <Skeleton className="h-[72px] rounded-2xl bg-surface-container-low" />
              <Skeleton className="h-[72px] rounded-2xl bg-surface-container-low" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2.5">
                <Label htmlFor="school-filter" className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">School</Label>
                <div className="relative">
                  <Input id="school-filter" value={selectedSchool?.name ?? "No school"} disabled className="rounded-xl border-none bg-surface-container-low/50 text-on-surface-variant font-medium" />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="filiere-filter" className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">Filiere</Label>
                <Select value={selectedFiliereId} onValueChange={setSelectedFiliereId} disabled={filieresLoading || !filieres.length}>
                  <SelectTrigger id="filiere-filter" className="rounded-xl border-none bg-surface-container-low hover:bg-surface-container shadow-sm transition-colors ring-offset-transparent focus:ring-0">
                    <SelectValue placeholder="Select filiere" />
                  </SelectTrigger>
                  <SelectContent className="border-none bg-surface-container-high shadow-sanctuary">
                    {filieres.map((filiere) => (
                      <SelectItem key={filiere.id} value={filiere.id} className="rounded-lg focus:bg-primary/5 focus:text-primary">
                        {filiere.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="promotion-filter" className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant ml-1">Promotion</Label>
                <Select value={selectedPromotionId} onValueChange={setSelectedPromotionId} disabled={promotionsLoading || !promotions.length}>
                  <SelectTrigger id="promotion-filter" className="rounded-xl border-none bg-surface-container-low hover:bg-surface-container shadow-sm transition-colors ring-offset-transparent focus:ring-0">
                    <SelectValue placeholder="Select promotion" />
                  </SelectTrigger>
                  <SelectContent className="border-none bg-surface-container-high shadow-sanctuary">
                    {promotions.map((promotion) => (
                      <SelectItem key={promotion.id} value={promotion.id} className="rounded-lg focus:bg-primary/5 focus:text-primary">
                        {promotion.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-on-surface">Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCreateTab} onValueChange={(value) => setActiveCreateTab(value as CreateTab)}>
            <TabsList className="mb-6 h-auto w-full grid-cols-3 gap-2 bg-surface-container-low p-1.5 rounded-2xl">
              <TabsTrigger value="filiere" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Filiere</TabsTrigger>
              <TabsTrigger value="promotion" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Promotion</TabsTrigger>
              <TabsTrigger value="class" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Class</TabsTrigger>
            </TabsList>

            <TabsContent value="filiere">
              <form className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end" onSubmit={handleCreateFiliere}>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="filiere-school">School</Label>
                  <Input id="filiere-school" value={selectedSchool?.name ?? "No school"} disabled />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="filiere-name">Filiere name</Label>
                  <Input
                    id="filiere-name"
                    placeholder="Informatique"
                    value={filiereForm.name}
                    onChange={(event) => setFiliereForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="md:col-span-1" disabled={creating === "filiere"}>
                  {creating === "filiere" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create filiere
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="promotion">
              <form className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end" onSubmit={handleCreatePromotion}>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="promotion-filiere">Filiere</Label>
                  <Select
                    value={promotionForm.filiere_id || selectedFiliereId}
                    onValueChange={(value) => setPromotionForm((prev) => ({ ...prev, filiere_id: value }))}
                    disabled={filieresLoading || !filieres.length}
                  >
                    <SelectTrigger id="promotion-filiere" aria-label="Select filiere for promotion">
                      <SelectValue placeholder="Select filiere" />
                    </SelectTrigger>
                    <SelectContent>
                      {filieres.map((filiere) => (
                        <SelectItem key={filiere.id} value={filiere.id}>
                          {filiere.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="promotion-name">Promotion name</Label>
                  <Input
                    id="promotion-name"
                    placeholder="2026"
                    value={promotionForm.name}
                    onChange={(event) => setPromotionForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="md:col-span-1" disabled={creating === "promotion"}>
                  {creating === "promotion" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create promotion
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="class">
              <form className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end" onSubmit={handleCreateClass}>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="class-promotion">Promotion</Label>
                  <Select
                    value={classForm.promotion_id || selectedPromotionId}
                    onValueChange={(value) => setClassForm((prev) => ({ ...prev, promotion_id: value }))}
                    disabled={promotionsLoading || !promotions.length}
                  >
                    <SelectTrigger id="class-promotion" aria-label="Select promotion for class">
                      <SelectValue placeholder="Select promotion" />
                    </SelectTrigger>
                    <SelectContent>
                      {promotions.map((promotion) => (
                        <SelectItem key={promotion.id} value={promotion.id}>
                          {promotion.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="class-name">Class name</Label>
                  <Input
                    id="class-name"
                    placeholder="GI-1A"
                    value={classForm.name}
                    onChange={(event) => setClassForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="class-academic-year">Academic year</Label>
                  <Input
                    id="class-academic-year"
                    placeholder="2026-2027"
                    value={classForm.academic_year}
                    onChange={(event) => setClassForm((prev) => ({ ...prev, academic_year: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="md:col-span-1" disabled={creating === "class"}>
                  {creating === "class" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create class
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-surface-container">
          <div>
            <CardTitle className="text-xl font-bold text-on-surface">Class catalog</CardTitle>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant flex items-center gap-1.5">
              <span className="text-primary">{selectedSchool?.name ?? "No school"}</span>
              <span className="opacity-30">|</span>
              <span>{selectedFiliere?.name ?? "No filiere"}</span>
              <span className="opacity-30">|</span>
              <span>{selectedPromotion?.name ?? "No promotion"}</span>
            </p>
          </div>
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-full px-4">{classes.length} entries</Badge>
        </CardHeader>
        <CardContent>
          {classesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              title="No classes for this promotion"
              message="Create a class from the Create entities section to start imports and content management."
              actionLabel="Create class"
              onAction={() => setActiveCreateTab("class")}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-surface-container-high hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Class</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Academic year</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((classItem) => (
                      <TableRow key={classItem.id} className="border-surface-container-low transition-colors hover:bg-surface-container-low/50">
                        <TableCell className="py-4 font-bold text-on-surface">{classItem.name}</TableCell>
                        <TableCell className="py-4 text-on-surface-variant font-medium">{classItem.academic_year}</TableCell>
                        <TableCell className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/classes/${classItem.id}/import`}>
                              <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 bg-surface-container-low hover:bg-surface-container-high text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                                <Upload className="h-3.5 w-3.5" />
                                <span>Import</span>
                              </Button>
                            </Link>
                            <Link href={`/admin/classes/${classItem.id}/content`}>
                              <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 bg-surface-container-low hover:bg-surface-container-high text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                                <ChevronRight className="h-3.5 w-3.5" />
                                <span>Content</span>
                              </Button>
                            </Link>
                            <Link href={`/admin/classes/${classItem.id}/students`}>
                              <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 bg-surface-container-low hover:bg-surface-container-high text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                                <Users className="h-3.5 w-3.5" />
                                <span>Roster</span>
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 md:hidden">
                {classes.map((classItem) => (
                  <div key={classItem.id} className="rounded-2xl bg-surface-container-low p-4 transition-all hover:bg-surface-container-high">
                    <p className="font-bold text-on-surface">{classItem.name}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant mt-1">{classItem.academic_year}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/admin/classes/${classItem.id}/import`}>
                        <Button variant="ghost" size="sm" className="rounded-lg bg-surface-container-highest/50 hover:bg-surface-container-highest transition-colors text-xs py-1 h-auto">
                          Import
                        </Button>
                      </Link>
                      <Link href={`/admin/classes/${classItem.id}/content`}>
                        <Button variant="ghost" size="sm" className="rounded-lg bg-surface-container-highest/50 hover:bg-surface-container-highest transition-colors text-xs py-1 h-auto">
                          Content
                        </Button>
                      </Link>
                      <Link href={`/admin/classes/${classItem.id}/students`}>
                        <Button variant="ghost" size="sm" className="rounded-lg bg-surface-container-highest/50 hover:bg-surface-container-highest transition-colors text-xs py-1 h-auto">
                          Roster
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
