"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Trash2, Upload } from "lucide-react";

import { classContentApi, getApiErrorMessage } from "@/lib/api";
import type { Exam, Project, Schedule } from "@/lib/admin-types";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type ContentTab = "schedules" | "exams" | "projects";
type DeleteTarget = { tab: ContentTab; id: string; label: string } | null;

interface ScheduleFormState {
  subject: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  professor: string;
}

interface ExamFormState {
  subject: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room: string;
}

interface ProjectFormState {
  name: string;
  subject: string;
  due_date: string;
  membersText: string;
}

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const INITIAL_SCHEDULE_FORM: ScheduleFormState = {
  subject: "",
  day_of_week: DAY_OPTIONS[0],
  start_time: "08:00",
  end_time: "10:00",
  room: "",
  professor: "",
};

const INITIAL_EXAM_FORM: ExamFormState = {
  subject: "",
  exam_date: "",
  start_time: "09:00",
  end_time: "11:00",
  room: "",
};

const INITIAL_PROJECT_FORM: ProjectFormState = {
  name: "",
  subject: "",
  due_date: "",
  membersText: "",
};

const toTimeInput = (value: string) => value.slice(0, 5);
const toDateInput = (value: string) => value.slice(0, 10);

const parseMembers = (value: string) =>
  value
    .split(/[\n,]/)
    .map((member) => member.trim())
    .filter(Boolean);

export default function ClassContentPage() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ContentTab>("schedules");
  const [applyToClassByTab, setApplyToClassByTab] = useState<Record<ContentTab, boolean>>({
    schedules: true,
    exams: true,
    projects: true,
  });

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loadingByTab, setLoadingByTab] = useState<Record<ContentTab, boolean>>({
    schedules: true,
    exams: true,
    projects: true,
  });
  const [errorByTab, setErrorByTab] = useState<Record<ContentTab, string>>({
    schedules: "",
    exams: "",
    projects: "",
  });

  const [savingByTab, setSavingByTab] = useState<Record<ContentTab, boolean>>({
    schedules: false,
    exams: false,
    projects: false,
  });

  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(INITIAL_SCHEDULE_FORM);
  const [examForm, setExamForm] = useState<ExamFormState>(INITIAL_EXAM_FORM);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [editScheduleForm, setEditScheduleForm] = useState<ScheduleFormState>(INITIAL_SCHEDULE_FORM);
  const [editExamForm, setEditExamForm] = useState<ExamFormState>(INITIAL_EXAM_FORM);
  const [editProjectForm, setEditProjectForm] = useState<ProjectFormState>(INITIAL_PROJECT_FORM);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const updateLoading = (tab: ContentTab, loading: boolean) => {
    setLoadingByTab((prev) => ({ ...prev, [tab]: loading }));
  };

  const updateError = (tab: ContentTab, message: string) => {
    setErrorByTab((prev) => ({ ...prev, [tab]: message }));
  };

  const updateSaving = (tab: ContentTab, saving: boolean) => {
    setSavingByTab((prev) => ({ ...prev, [tab]: saving }));
  };

  const loadSchedules = useCallback(async () => {
    if (!classId) return;
    updateLoading("schedules", true);
    updateError("schedules", "");
    try {
      const response = await classContentApi.listSchedules(classId);
      setSchedules(response);
    } catch (error: unknown) {
      updateError("schedules", getApiErrorMessage(error, "Unable to load schedules."));
      setSchedules([]);
    } finally {
      updateLoading("schedules", false);
    }
  }, [classId]);

  const loadExams = useCallback(async () => {
    if (!classId) return;
    updateLoading("exams", true);
    updateError("exams", "");
    try {
      const response = await classContentApi.listExams(classId);
      setExams(response);
    } catch (error: unknown) {
      updateError("exams", getApiErrorMessage(error, "Unable to load exams."));
      setExams([]);
    } finally {
      updateLoading("exams", false);
    }
  }, [classId]);

  const loadProjects = useCallback(async () => {
    if (!classId) return;
    updateLoading("projects", true);
    updateError("projects", "");
    try {
      const response = await classContentApi.listProjects(classId);
      setProjects(response);
    } catch (error: unknown) {
      updateError("projects", getApiErrorMessage(error, "Unable to load projects."));
      setProjects([]);
    } finally {
      updateLoading("projects", false);
    }
  }, [classId]);

  useEffect(() => {
    void Promise.all([loadSchedules(), loadExams(), loadProjects()]);
  }, [loadSchedules, loadExams, loadProjects]);

  const handleCreateSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!scheduleForm.subject.trim()) {
      toast({ title: "Validation error", description: "Subject is required.", variant: "destructive" });
      return;
    }

    updateSaving("schedules", true);
    try {
      const response = await classContentApi.createSchedule(classId, {
        subject: scheduleForm.subject.trim(),
        day_of_week: scheduleForm.day_of_week,
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        room: scheduleForm.room.trim(),
        professor: scheduleForm.professor.trim(),
      });
      setScheduleForm(INITIAL_SCHEDULE_FORM);
      toast({ title: "Schedule created", description: response.message });
      await loadSchedules();
    } catch (error: unknown) {
      toast({
        title: "Create failed",
        description: getApiErrorMessage(error, "Unable to create schedule."),
        variant: "destructive",
      });
    } finally {
      updateSaving("schedules", false);
    }
  };

  const handleCreateExam = async (event: FormEvent) => {
    event.preventDefault();
    if (!examForm.subject.trim() || !examForm.exam_date) {
      toast({
        title: "Validation error",
        description: "Subject and exam date are required.",
        variant: "destructive",
      });
      return;
    }

    updateSaving("exams", true);
    try {
      const response = await classContentApi.createExam(classId, {
        subject: examForm.subject.trim(),
        exam_date: examForm.exam_date,
        start_time: examForm.start_time,
        end_time: examForm.end_time,
        room: examForm.room.trim(),
      });
      setExamForm(INITIAL_EXAM_FORM);
      toast({ title: "Exam created", description: response.message });
      await loadExams();
    } catch (error: unknown) {
      toast({
        title: "Create failed",
        description: getApiErrorMessage(error, "Unable to create exam."),
        variant: "destructive",
      });
    } finally {
      updateSaving("exams", false);
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectForm.name.trim() || !projectForm.subject.trim() || !projectForm.due_date) {
      toast({
        title: "Validation error",
        description: "Project name, subject, and due date are required.",
        variant: "destructive",
      });
      return;
    }

    updateSaving("projects", true);
    try {
      const response = await classContentApi.createProject(classId, {
        name: projectForm.name.trim(),
        subject: projectForm.subject.trim(),
        due_date: projectForm.due_date,
        members: parseMembers(projectForm.membersText),
      });
      setProjectForm(INITIAL_PROJECT_FORM);
      toast({ title: "Project created", description: response.message });
      await loadProjects();
    } catch (error: unknown) {
      toast({
        title: "Create failed",
        description: getApiErrorMessage(error, "Unable to create project."),
        variant: "destructive",
      });
    } finally {
      updateSaving("projects", false);
    }
  };

  const openEditSchedule = (item: Schedule) => {
    setEditingSchedule(item);
    setEditScheduleForm({
      subject: item.subject,
      day_of_week: item.day_of_week,
      start_time: toTimeInput(item.start_time),
      end_time: toTimeInput(item.end_time),
      room: item.room,
      professor: item.professor,
    });
  };

  const openEditExam = (item: Exam) => {
    setEditingExam(item);
    setEditExamForm({
      subject: item.subject,
      exam_date: toDateInput(item.exam_date),
      start_time: toTimeInput(item.start_time),
      end_time: toTimeInput(item.end_time),
      room: item.room,
    });
  };

  const openEditProject = (item: Project) => {
    setEditingProject(item);
    setEditProjectForm({
      name: item.name,
      subject: item.subject,
      due_date: toDateInput(item.due_date),
      membersText: item.members.join(", "),
    });
  };

  const handleUpdateSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingSchedule) return;

    updateSaving("schedules", true);
    try {
      const response = await classContentApi.updateSchedule(
        classId,
        editingSchedule.id,
        {
          subject: editScheduleForm.subject.trim(),
          day_of_week: editScheduleForm.day_of_week,
          start_time: editScheduleForm.start_time,
          end_time: editScheduleForm.end_time,
          room: editScheduleForm.room.trim(),
          professor: editScheduleForm.professor.trim(),
        },
        applyToClassByTab.schedules
      );
      toast({ title: "Schedule updated", description: response.message });
      setEditingSchedule(null);
      await loadSchedules();
    } catch (error: unknown) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(error, "Unable to update schedule."),
        variant: "destructive",
      });
    } finally {
      updateSaving("schedules", false);
    }
  };

  const handleUpdateExam = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingExam) return;

    updateSaving("exams", true);
    try {
      const response = await classContentApi.updateExam(
        classId,
        editingExam.id,
        {
          subject: editExamForm.subject.trim(),
          exam_date: editExamForm.exam_date,
          start_time: editExamForm.start_time,
          end_time: editExamForm.end_time,
          room: editExamForm.room.trim(),
        },
        applyToClassByTab.exams
      );
      toast({ title: "Exam updated", description: response.message });
      setEditingExam(null);
      await loadExams();
    } catch (error: unknown) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(error, "Unable to update exam."),
        variant: "destructive",
      });
    } finally {
      updateSaving("exams", false);
    }
  };

  const handleUpdateProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingProject) return;

    updateSaving("projects", true);
    try {
      const response = await classContentApi.updateProject(
        classId,
        editingProject.id,
        {
          name: editProjectForm.name.trim(),
          subject: editProjectForm.subject.trim(),
          due_date: editProjectForm.due_date,
          members: parseMembers(editProjectForm.membersText),
        },
        applyToClassByTab.projects
      );
      toast({ title: "Project updated", description: response.message });
      setEditingProject(null);
      await loadProjects();
    } catch (error: unknown) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(error, "Unable to update project."),
        variant: "destructive",
      });
    } finally {
      updateSaving("projects", false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.tab === "schedules") {
        const response = await classContentApi.deleteSchedule(
          classId,
          deleteTarget.id,
          applyToClassByTab.schedules
        );
        toast({ title: "Schedule deleted", description: response.message });
        await loadSchedules();
      }
      if (deleteTarget.tab === "exams") {
        const response = await classContentApi.deleteExam(classId, deleteTarget.id, applyToClassByTab.exams);
        toast({ title: "Exam deleted", description: response.message });
        await loadExams();
      }
      if (deleteTarget.tab === "projects") {
        const response = await classContentApi.deleteProject(classId, deleteTarget.id, applyToClassByTab.projects);
        toast({ title: "Project deleted", description: response.message });
        await loadProjects();
      }
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast({
        title: "Delete failed",
        description: getApiErrorMessage(error, "Unable to delete content item."),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const currentApplyToClass = applyToClassByTab[activeTab];
  const scopeLabel = currentApplyToClass ? "Apply to whole class" : "Apply to single student row";

  const riskBadge = useMemo(() => {
    if (!currentApplyToClass) return null;
    return <Badge variant="warning">Bulk scope enabled</Badge>;
  }, [currentApplyToClass]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/classes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to classes
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Class content manager</h1>
          <p className="mt-1 text-sm text-slate-500">Create, update, and delete schedules, exams, and projects for this class.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/classes/${classId}/import`}>
            <Button variant="secondary">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
          <Link href={`/admin/classes/${classId}/students`}>
            <Button variant="secondary">View students</Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 !p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Patch/Delete scope</p>
            <p className="text-sm text-slate-500">{scopeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {riskBadge}
            <Switch
              id="apply-to-class-toggle"
              checked={currentApplyToClass}
              onCheckedChange={(checked) =>
                setApplyToClassByTab((prev) => ({ ...prev, [activeTab]: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ContentTab)}>
        <TabsList className="grid w-full grid-cols-3 py-1 px-1 rounded-xl">
          <TabsTrigger value="schedules" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Schedules</TabsTrigger>
          <TabsTrigger value="exams" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Exams</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-xl w-full py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold transition-all">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Create schedule entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end" onSubmit={handleCreateSchedule}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="schedule-subject">Subject</Label>
                  <Input
                    id="schedule-subject"
                    value={scheduleForm.subject}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, subject: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-day">Day</Label>
                  <Input
                    id="schedule-day"
                    list="schedule-day-options"
                    value={scheduleForm.day_of_week}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, day_of_week: event.target.value }))}
                    required
                  />
                  <datalist id="schedule-day-options">
                    {DAY_OPTIONS.map((day) => (
                      <option key={day} value={day} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-start">Start</Label>
                  <Input
                    id="schedule-start"
                    type="time"
                    value={scheduleForm.start_time}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, start_time: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-end">End</Label>
                  <Input
                    id="schedule-end"
                    type="time"
                    value={scheduleForm.end_time}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, end_time: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={savingByTab.schedules}>
                  {savingByTab.schedules ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add
                </Button>
              </form>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schedule-room">Room</Label>
                  <Input
                    id="schedule-room"
                    value={scheduleForm.room}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, room: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-professor">Professor</Label>
                  <Input
                    id="schedule-professor"
                    value={scheduleForm.professor}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, professor: event.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingByTab.schedules ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-12 rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : errorByTab.schedules ? (
                <ErrorState message={errorByTab.schedules} onRetry={() => void loadSchedules()} />
              ) : schedules.length === 0 ? (
                <EmptyState title="No schedules yet" message="Create a schedule entry or import CSV data." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Professor</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.subject}</TableCell>
                        <TableCell>{item.day_of_week}</TableCell>
                        <TableCell>
                          {toTimeInput(item.start_time)} - {toTimeInput(item.end_time)}
                        </TableCell>
                        <TableCell>{item.room || "-"}</TableCell>
                        <TableCell>{item.professor || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEditSchedule(item)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget({ tab: "schedules", id: item.id, label: item.subject })}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Create exam entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end" onSubmit={handleCreateExam}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="exam-subject">Subject</Label>
                  <Input
                    id="exam-subject"
                    value={examForm.subject}
                    onChange={(event) => setExamForm((prev) => ({ ...prev, subject: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="exam-date">Date</Label>
                  <Input
                    id="exam-date"
                    type="date"
                    value={examForm.exam_date}
                    onChange={(event) => setExamForm((prev) => ({ ...prev, exam_date: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-start">Start</Label>
                  <Input
                    id="exam-start"
                    type="time"
                    value={examForm.start_time}
                    onChange={(event) => setExamForm((prev) => ({ ...prev, start_time: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam-end">End</Label>
                  <Input
                    id="exam-end"
                    type="time"
                    value={examForm.end_time}
                    onChange={(event) => setExamForm((prev) => ({ ...prev, end_time: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={savingByTab.exams}>
                  {savingByTab.exams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add
                </Button>
              </form>
              <div className="mt-3 max-w-sm space-y-2">
                <Label htmlFor="exam-room">Room</Label>
                <Input
                  id="exam-room"
                  value={examForm.room}
                  onChange={(event) => setExamForm((prev) => ({ ...prev, room: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Exams</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingByTab.exams ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-12 rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : errorByTab.exams ? (
                <ErrorState message={errorByTab.exams} onRetry={() => void loadExams()} />
              ) : exams.length === 0 ? (
                <EmptyState title="No exams yet" message="Create an exam entry or import exam CSV." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.subject}</TableCell>
                        <TableCell>{toDateInput(item.exam_date)}</TableCell>
                        <TableCell>
                          {toTimeInput(item.start_time)} - {toTimeInput(item.end_time)}
                        </TableCell>
                        <TableCell>{item.room || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEditExam(item)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget({ tab: "exams", id: item.id, label: item.subject })}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Create project entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid grid-cols-1 gap-3 md:grid-cols-6 md:items-end" onSubmit={handleCreateProject}>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="project-name">Project name</Label>
                  <Input
                    id="project-name"
                    value={projectForm.name}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="project-subject">Subject</Label>
                  <Input
                    id="project-subject"
                    value={projectForm.subject}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, subject: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="project-due-date">Due date</Label>
                  <Input
                    id="project-due-date"
                    type="date"
                    value={projectForm.due_date}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, due_date: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" disabled={savingByTab.projects}>
                  {savingByTab.projects ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add
                </Button>
              </form>
              <div className="mt-3 max-w-2xl space-y-2">
                <Label htmlFor="project-members">Members (comma or newline separated)</Label>
                <Textarea
                  id="project-members"
                  rows={3}
                  value={projectForm.membersText}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, membersText: event.target.value }))}
                  placeholder="Alice, Bob, Claire"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingByTab.projects ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-12 rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : errorByTab.projects ? (
                <ErrorState message={errorByTab.projects} onRetry={() => void loadProjects()} />
              ) : projects.length === 0 ? (
                <EmptyState title="No projects yet" message="Create a project entry or import project CSV." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell>{toDateInput(item.due_date)}</TableCell>
                        <TableCell>{item.members.join(", ") || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => openEditProject(item)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget({ tab: "projects", id: item.id, label: item.name })}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingSchedule)} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit schedule</DialogTitle>
            <DialogDescription>Apply changes based on the current patch scope toggle.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleUpdateSchedule}>
            <div className="space-y-2">
              <Label htmlFor="edit-schedule-subject">Subject</Label>
              <Input
                id="edit-schedule-subject"
                value={editScheduleForm.subject}
                onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, subject: event.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-day">Day</Label>
                <Input
                  id="edit-schedule-day"
                  value={editScheduleForm.day_of_week}
                  onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, day_of_week: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-start">Start</Label>
                <Input
                  id="edit-schedule-start"
                  type="time"
                  value={editScheduleForm.start_time}
                  onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-end">End</Label>
                <Input
                  id="edit-schedule-end"
                  type="time"
                  value={editScheduleForm.end_time}
                  onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-room">Room</Label>
                <Input
                  id="edit-schedule-room"
                  value={editScheduleForm.room}
                  onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, room: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-schedule-professor">Professor</Label>
                <Input
                  id="edit-schedule-professor"
                  value={editScheduleForm.professor}
                  onChange={(event) => setEditScheduleForm((prev) => ({ ...prev, professor: event.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingByTab.schedules}>
                {savingByTab.schedules ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingExam)} onOpenChange={(open) => !open && setEditingExam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit exam</DialogTitle>
            <DialogDescription>Apply changes based on the current patch scope toggle.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleUpdateExam}>
            <div className="space-y-2">
              <Label htmlFor="edit-exam-subject">Subject</Label>
              <Input
                id="edit-exam-subject"
                value={editExamForm.subject}
                onChange={(event) => setEditExamForm((prev) => ({ ...prev, subject: event.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-exam-date">Date</Label>
                <Input
                  id="edit-exam-date"
                  type="date"
                  value={editExamForm.exam_date}
                  onChange={(event) => setEditExamForm((prev) => ({ ...prev, exam_date: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-exam-start">Start</Label>
                <Input
                  id="edit-exam-start"
                  type="time"
                  value={editExamForm.start_time}
                  onChange={(event) => setEditExamForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-exam-end">End</Label>
                <Input
                  id="edit-exam-end"
                  type="time"
                  value={editExamForm.end_time}
                  onChange={(event) => setEditExamForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-exam-room">Room</Label>
              <Input
                id="edit-exam-room"
                value={editExamForm.room}
                onChange={(event) => setEditExamForm((prev) => ({ ...prev, room: event.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingByTab.exams}>
                {savingByTab.exams ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingProject)} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Apply changes based on the current patch scope toggle.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleUpdateProject}>
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Name</Label>
              <Input
                id="edit-project-name"
                value={editProjectForm.name}
                onChange={(event) => setEditProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-subject">Subject</Label>
              <Input
                id="edit-project-subject"
                value={editProjectForm.subject}
                onChange={(event) => setEditProjectForm((prev) => ({ ...prev, subject: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-due-date">Due date</Label>
              <Input
                id="edit-project-due-date"
                type="date"
                value={editProjectForm.due_date}
                onChange={(event) => setEditProjectForm((prev) => ({ ...prev, due_date: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-members">Members</Label>
              <Textarea
                id="edit-project-members"
                rows={3}
                value={editProjectForm.membersText}
                onChange={(event) => setEditProjectForm((prev) => ({ ...prev, membersText: event.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingByTab.projects}>
                {savingByTab.projects ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm deletion</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget?.label}</strong>? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
