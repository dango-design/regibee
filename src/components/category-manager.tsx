"use client";

import { useState } from "react";
import { FolderOpen, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { Input } from "@/components/base/input/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/registry";

interface CategoryManagerProps {
  registryId: string;
  categories: { id: string; name: string; sort_order: number }[];
  inline?: boolean;
}

export function CategoryManager({
  registryId,
  categories,
  inline,
}: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  // The category waiting for the owner to confirm its delete.
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await createCategory(registryId, newName.trim());
    setNewName("");
    setLoading(false);
  };

  const handleUpdate = async (categoryId: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    await updateCategory(categoryId, registryId, editName.trim());
    setEditingId(null);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setLoading(true);
    await deleteCategory(deleting.id, registryId);
    setLoading(false);
    setDeleting(null);
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const categoryList = (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-2">
          {editingId === cat.id ? (
            <>
              <Input
                value={editName}
                onChange={(val) => setEditName(val)}
                aria-label="Category name"
                enterKeyHint="done"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdate(cat.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleUpdate(cat.id)}
                disabled={loading}
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingId(null)}
                aria-label="Cancel renaming"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm">{cat.name}</span>
              {/* Rename and Delete are rare, so they share one "…" menu
                  instead of two buttons on every row. */}
              <RowActionsMenu
                label={`More actions for ${cat.name}`}
                actions={[
                  { id: "rename", label: "Rename", icon: Pencil },
                  { id: "delete", label: "Delete", icon: Trash2, destructive: true },
                ]}
                disabled={loading}
                onAction={(id) =>
                  id === "rename" ? startEditing(cat.id, cat.name) : setDeleting({ id: cat.id, name: cat.name })
                }
              />
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-4 border-t">
        <Input
          value={newName}
          onChange={(val) => setNewName(val)}
          placeholder="New category name"
          enterKeyHint="done"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          aria-label="Add category"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ConfirmActionDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the ${deleting?.name ?? ""} category?`}
        description="Its items stay on the list, with no category."
        confirmLabel="Delete"
        working={loading}
        onConfirm={handleDelete}
      />
    </div>
  );

  if (inline) {
    return categoryList;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <span className="inline-flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4 shrink-0" />
            Categories
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Manage Categories</SheetTitle>
          <SheetDescription>
            Add, rename, or delete item categories.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {categoryList}
        </div>
      </SheetContent>
    </Sheet>
  );
}
