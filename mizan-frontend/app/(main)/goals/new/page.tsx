"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, goalsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewGoalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsedTarget = Number(targetValue);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError("Target value must be greater than 0.");
      return;
    }
    setLoading(true);
    try {
      await goalsApi.create({
        title,
        target_value: parsedTarget,
        unit,
      });
      router.push("/goals");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Error while creating goal."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter max-w-lg mx-auto px-1">
      <Link href="/goals" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to goals
      </Link>

      <h1 className="text-2xl font-bold mb-6">New goal</h1>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Goal title</Label>
              <Input
                id="title"
                placeholder="Ex: Pass my semester"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target">Target value</Label>
                <Input
                  id="target"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 16"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  placeholder="Ex: /20"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create goal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
