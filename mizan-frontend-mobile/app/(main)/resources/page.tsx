"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage, resourcesApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Resource, ResourceType } from "@/lib/types";
import { Loader2, Video, FileText, Dumbbell, ExternalLink } from "lucide-react";

const TYPE_CONFIG: Record<ResourceType, { icon: React.ElementType; label: string; color: string }> = {
  VIDEO: { icon: Video, label: "Vidéo", color: "bg-indigo-50 text-indigo-600" },
  ARTICLE: { icon: FileText, label: "Article", color: "bg-emerald-50 text-emerald-600" },
  EXERCISE: { icon: Dumbbell, label: "Exercice", color: "bg-amber-50 text-amber-600" },
};

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"for-me" | "all">("for-me");
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [forMeData, allData] = await Promise.all([resourcesApi.getForMe(), resourcesApi.list()]);
      setResources(forMeData);
      setAllResources(allData);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger les ressources."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentList = tab === "for-me" ? resources : allResources;

  return (
    <div className="page-enter space-y-8 max-w-4xl mx-auto px-1">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Ressources Bien-être</h1>
        <p className="text-on-surface-variant mt-2">
          Des ressources personnalisées selon votre humeur actuelle.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "for-me" | "all")}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="for-me">Pour moi</TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <button className="text-sm font-semibold text-primary hover:underline" onClick={() => void fetchData()}>
              Réessayer
            </button>
          </CardContent>
        </Card>
      )}

      {currentList.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-on-surface-variant">Aucune ressource disponible pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentList.map((resource) => {
            const config = TYPE_CONFIG[resource.type];
            const Icon = config.icon;
            return (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="hover:shadow-sanctuary-lg transition-shadow cursor-pointer h-full">
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-1">{resource.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="secondary" className="text-[10px]">{config.label}</Badge>
                          {resource.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center text-xs text-primary">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ouvrir
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
