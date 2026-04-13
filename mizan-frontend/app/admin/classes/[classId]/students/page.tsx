"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Pencil, Phone, Plus, Trash2, UserSquare2 } from "lucide-react";

import { getApiErrorMessage, studentsApi } from "@/lib/api";
import type { Student } from "@/lib/admin-types";
import { EmptyState, ErrorState } from "@/components/admin/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

export default function ClassStudentsPage() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError("");
    try {
      const response = await studentsApi.listByClass(classId);
      setStudents(response);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load students."));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!classId) return;

    const formData = new FormData(e.currentTarget);
    const data = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
      cne: formData.get("cne") as string,
      phone: (formData.get("phone") as string) || undefined,
      class_id: classId,
    };

    setIsSubmitting(true);
    try {
      if (editingStudent) {
        await studentsApi.update(editingStudent.id, data);
        toast({ title: "Student updated", description: "The student profile has been updated successfully." });
      } else {
        await studentsApi.create(data);
        toast({ title: "Student created", description: "New student has been enrolled successfully." });
      }
      setIsFormOpen(false);
      setEditingStudent(null);
      void loadStudents();
    } catch (saveError: unknown) {
      toast({
        title: "Error",
        description: getApiErrorMessage(saveError, "Unable to save student."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student? This will also delete their associated user account.")) return;

    try {
      await studentsApi.remove(studentId);
      toast({ title: "Student removed", description: "The student has been successfully removed from the class." });
      void loadStudents();
    } catch (removeError: unknown) {
      toast({
        title: "Error",
        description: getApiErrorMessage(removeError, "Unable to remove student."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/classes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to classes
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Class students</h1>
          <p className="mt-1 text-sm text-slate-500">Student list, profile preview, and photo action links for this class.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setEditingStudent(null); setIsFormOpen(true); }} className="rounded-xl shadow-sanctuary">
            <Plus className="mr-2 h-4 w-4" />
            Add student
          </Button>
          <Link href={`/admin/classes/${classId}/import`}>
            <Button variant="ghost" className="bg-surface-container-low hover:bg-surface-container-high text-primary">Import CSV</Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">Students</CardTitle>
          <Badge variant="secondary">{students.length} enrolled</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void loadStudents()} />
          ) : students.length === 0 ? (
            <EmptyState
              title="No students yet"
              message="Import Trombi CSV from the import center to populate this class."
              actionLabel="Go to import"
              onAction={() => window.location.assign(`/admin/classes/${classId}/import`)}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>CNE</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-100">
                              {student.photo_url ? (
                                <Image src={student.photo_url} alt={student.first_name} fill className="object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                                  {student.first_name.charAt(0)}
                                  {student.last_name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {student.first_name} {student.last_name}
                              </p>
                              <p className="text-xs text-slate-500">{student.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{student.cne}</TableCell>
                        <TableCell>{student.email ?? "-"}</TableCell>
                        <TableCell>{student.phone ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary" onClick={() => setSelectedStudent(student)}>
                              <UserSquare2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary" onClick={() => { setEditingStudent(student); setIsFormOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" onClick={() => void handleDelete(student.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 md:hidden">
                {students.map((student) => (
                  <div key={student.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                        {student.photo_url ? (
                          <Image src={student.photo_url} alt={student.first_name} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                            {student.first_name.charAt(0)}
                            {student.last_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-slate-500">CNE: {student.cne}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(student)}>
                        Profile
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setEditingStudent(student); setIsFormOpen(true); }}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100" onClick={() => void handleDelete(student.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingStudent(null); } }}>
        <DialogContent className="max-w-md border-none bg-white shadow-sanctuary rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Edit student" : "Add new student"}</DialogTitle>
            <DialogDescription>
              {editingStudent ? "Update the student's profile information." : "Enroll a new student manually in this class."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateOrUpdate(e)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" name="first_name" defaultValue={editingStudent?.first_name} required className="rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" name="last_name" defaultValue={editingStudent?.last_name} required className="rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" defaultValue={editingStudent?.email || ""} required disabled={!!editingStudent} className="rounded-xl border-slate-200 focus:border-primary focus:ring-primary disabled:bg-slate-50" />
              {editingStudent && <p className="text-[10px] text-slate-500">Email cannot be changed after creation.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cne">CNE / Student ID</Label>
              <Input id="cne" name="cne" defaultValue={editingStudent?.cne} required className="rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number (Optional)</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={editingStudent?.phone || ""} className="rounded-xl border-slate-200 focus:border-primary focus:ring-primary" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl shadow-sanctuary">
                {isSubmitting ? "Saving..." : editingStudent ? "Update student" : "Create student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-md border-none bg-white shadow-sanctuary rounded-3xl">
          <DialogHeader>
            <DialogTitle>Student profile</DialogTitle>
            <DialogDescription>Preview key student information and available contact/photo links.</DialogDescription>
          </DialogHeader>
          {selectedStudent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-slate-100">
                  {selectedStudent.photo_url ? (
                    <Image src={selectedStudent.photo_url} alt={selectedStudent.first_name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                      {selectedStudent.first_name.charAt(0)}
                      {selectedStudent.last_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="text-sm text-slate-500">CNE: {selectedStudent.cne}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail className="h-4 w-4 text-slate-500" />
                  {selectedStudent.email ? (
                    <a href={`mailto:${selectedStudent.email}`} className="hover:underline">
                      {selectedStudent.email}
                    </a>
                  ) : (
                    <span>No email available</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="h-4 w-4 text-slate-500" />
                  {selectedStudent.phone ? (
                    <a href={`tel:${selectedStudent.phone}`} className="hover:underline">
                      {selectedStudent.phone}
                    </a>
                  ) : (
                    <span>No phone available</span>
                  )}
                </div>
              </div>

              {selectedStudent.photo_url ? (
                <Button variant="secondary" asChild className="w-full rounded-xl">
                  <a href={selectedStudent.photo_url} target="_blank" rel="noreferrer">
                    Open full photo
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
