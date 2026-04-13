"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";

import { getApiErrorMessage, resourcesApi } from "@/lib/api";
import type { Resource, ResourceType } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await resourcesApi.list();
      setResources(response);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, "Unable to load resources."));
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      title: formData.get("title") as string,
      type: formData.get("type") as ResourceType,
      url: formData.get("url") as string,
      category: formData.get("category") as string,
      mood_trigger: formData.get("mood_trigger") as string,
      tags: (formData.get("tags") as string).split(",").map(t => t.trim()).filter(Boolean),
      description: (formData.get("description") as string) || undefined,
      ai_instruction: (formData.get("ai_instruction") as string) || undefined,
    };

    setIsSubmitting(true);
    try {
      if (editingResource) {
        await resourcesApi.update(editingResource.id, payload);
        toast({ title: "Resource updated", description: "Changes saved to the reference library." });
      } else {
        await resourcesApi.create(payload);
        toast({ title: "Resource created", description: "New resource added to the catalog." });
      }
      setIsFormOpen(false);
      setEditingResource(null);
      void loadResources();
    } catch (saveError: unknown) {
      toast({
        title: "Error",
        description: getApiErrorMessage(saveError, "Unable to save resource."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    try {
      await resourcesApi.remove(resourceId);
      toast({ title: "Resource deleted", description: "Item removed from the catalog." });
      void loadResources();
    } catch (removeError: unknown) {
      toast({
        title: "Error",
        description: getApiErrorMessage(removeError, "Unable to delete resource."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">Resources</h1>
          <p className="mt-2 text-base text-on-surface-variant">Reference library available for learners and support teams.</p>
        </div>
        <Button onClick={() => { setEditingResource(null); setIsFormOpen(true); }} className="rounded-xl shadow-sanctuary">
          <Plus className="mr-2 h-4 w-4" />
          Add resource
        </Button>
      </header>

      <Card className="overflow-hidden border-none bg-surface-container-lowest shadow-sanctuary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-surface-container">
          <CardTitle className="text-xl font-bold text-on-surface">Resource catalog</CardTitle>
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-full px-4">{resources.length} items</Badge>
        </CardHeader>
        <CardContent className="!p-0">
          {loading ? (
            <div className="flex items-center justify-center p-20 gap-3 text-sm text-on-surface-variant font-medium">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Syncing library...
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => void loadResources()} />
            </div>
          ) : resources.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No resources found" message="Seed resources from backend admin endpoints when needed." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-surface-container-high hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant pl-6">Title</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Type</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Mood trigger</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">Tags</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((resource: Resource) => (
                    <TableRow key={resource.id} className="border-surface-container-low transition-colors hover:bg-surface-container-low/50">
                      <TableCell className="py-4 font-bold text-on-surface pl-6">
                        <div>
                          <p>{resource.title}</p>
                          {resource.category && <p className="text-[10px] text-primary/70 font-medium uppercase tracking-wider">{resource.category}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="bg-surface-container-highest text-on-surface-variant border-none">{resource.type}</Badge>
                      </TableCell>
                      <TableCell className="py-4 text-on-surface-variant font-medium">{resource.mood_trigger}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {resource.tags.map((tag: string) => (
                            <span key={tag} className="text-[10px] font-semibold text-on-surface-variant/70 bg-surface-container-low px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          )) || <span className="text-on-surface-variant/30">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-primary/5 text-primary hover:bg-primary/10" asChild>
                            <a href={resource.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container-high" onClick={() => { setEditingResource(resource); setIsFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" onClick={() => void handleDelete(resource.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingResource(null); } }}>
        <DialogContent className="max-w-2xl border-none bg-white shadow-sanctuary rounded-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit resource" : "Add advanced resource"}</DialogTitle>
            <DialogDescription>
              Configure how this resource helps students and how the AI should recommend it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateOrUpdate(e)} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={editingResource?.title} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" defaultValue={editingResource?.category || "General"} required className="rounded-xl" placeholder="e.g. Mental Health, Academic" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Resource Type</Label>
                <Select name="type" defaultValue={editingResource?.type || "ARTICLE"}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="ARTICLE">Article</SelectItem>
                    <SelectItem value="EXERCISE">Exercise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mood_trigger">Mood Trigger</Label>
                <Input id="mood_trigger" name="mood_trigger" defaultValue={editingResource?.mood_trigger} required className="rounded-xl" placeholder="e.g. anxiete, stress" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Resource URL</Label>
              <Input id="url" name="url" type="url" defaultValue={editingResource?.url} required className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input id="tags" name="tags" defaultValue={editingResource?.tags.join(", ")} className="rounded-xl" placeholder="stress, revision, sleep" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short Description (for Support Teams)</Label>
              <Textarea id="description" name="description" defaultValue={editingResource?.description || ""} className="rounded-xl" rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_instruction">AI Agent Instructions</Label>
              <Textarea id="ai_instruction" name="ai_instruction" defaultValue={editingResource?.ai_instruction || ""} className="rounded-xl" placeholder="Advise the student to use this when they report high exam stress..." rows={3} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl shadow-sanctuary">
                {isSubmitting ? "Saving..." : editingResource ? "Update resource" : "Create resource"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
