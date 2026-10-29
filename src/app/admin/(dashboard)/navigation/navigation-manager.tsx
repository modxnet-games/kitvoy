"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import type { NavItem } from "@/lib/data/navigation";
import {
  saveNavigationItemAction,
  deleteNavigationItemAction,
  seedNavigationAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Props {
  initialItems: NavItem[];
}

export function NavigationManager({ initialItems }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = (formData: FormData) => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveNavigationItemAction(formData);
        if (result.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          router.refresh();
        } else {
          setError(result.error ?? "Failed to save.");
        }
      } catch {
        setError("Failed to save. Please try again.");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this navigation item?")) return;
    startTransition(async () => {
      await deleteNavigationItemAction(id);
      router.refresh();
    });
  };

  const handleSeed = () => {
    startTransition(async () => {
      await seedNavigationAction();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {initialItems.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No navigation items yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleSeed} disabled={isPending}>
            Load default navigation
          </Button>
        </div>
      )}

      {initialItems.map((item) => (
        <form
          key={item.id}
          action={handleSave}
          className="rounded-lg border bg-card p-4"
        >
          <input type="hidden" name="id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
              <Input name="label" defaultValue={item.label} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Link</label>
              <Input name="link" defaultValue={item.link} placeholder="/shop" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
              <Input name="position" type="number" defaultValue={item.position} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  name="isVisible"
                  id={`vis-${item.id}`}
                  defaultChecked={item.isVisible}
                  className="size-4 rounded border-input accent-primary"
                />
                <label htmlFor={`vis-${item.id}`} className="text-xs font-medium">Visible</label>
              </div>
              <Button type="submit" size="sm" disabled={isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(item.id)}
                disabled={isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </form>
      ))}

      <Separator />

      {/* Add new */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Add new link</h3>
        <form action={handleSave} className="rounded-lg border bg-card p-4">
          <input type="hidden" name="id" value="" />
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
              <Input name="label" placeholder="About Us" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Link</label>
              <Input name="link" placeholder="/about" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Position</label>
              <Input name="position" type="number" defaultValue={initialItems.length} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  name="isVisible"
                  id="vis-new"
                  defaultChecked
                  className="size-4 rounded border-input accent-primary"
                />
                <label htmlFor="vis-new" className="text-xs font-medium">Visible</label>
              </div>
              <Button type="submit" size="sm" disabled={isPending} className="gap-1">
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Feedback */}
      {(saved || error) && (
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-green-600">
              <Check className="size-4" />
              Saved
            </span>
          )}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
