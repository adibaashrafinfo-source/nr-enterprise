import { useRef, useState, type DragEvent } from "react";
import { GripVertical, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import type { AdminProduct, ProductImage } from "@/lib/types";
import { apiFieldErrors, type useCatalogueAccess } from "./shared";

export function ImagesPanel({ product, access }: { product: AdminProduct; access: ReturnType<typeof useCatalogueAccess> }) {
  const { canEdit, invalidate } = access;
  const [images, setImages] = useState<ProductImage[]>(product.images);
  const [busy, setBusy] = useState(false);
  const dragId = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastSeen, setLastSeen] = useState(product.images);
  if (lastSeen !== product.images) { setLastSeen(product.images); setImages(product.images); }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try { for (const file of Array.from(files)) await adminApi.uploadProductImage(product.id, file); toast.success("Photos uploaded."); }
    catch (e) { apiFieldErrors(e); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; await invalidate(); }
  };
  const saveOrder = async (next: ProductImage[], primaryId: number) => {
    setImages(next.map((img) => ({ ...img, is_primary: img.id === primaryId })));
    try { await adminApi.orderProductImages(product.id, next.map((i) => i.id), primaryId); await invalidate(); } catch (e) { apiFieldErrors(e); setImages(product.images); }
  };
  const primaryId = images.find((i) => i.is_primary)?.id ?? images[0]?.id ?? 0;
  const onDrop = (e: DragEvent, targetId: number) => {
    e.preventDefault();
    const from = images.findIndex((i) => i.id === dragId.current), to = images.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...images]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved!);
    void saveOrder(next, primaryId);
  };
  const remove = async (img: ProductImage) => {
    if (!window.confirm("Delete this photo?")) return;
    try { await adminApi.deleteProductImage(img.id); toast.success("Photo deleted."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Photos</h2><p className="text-sm text-muted-foreground">{canEdit ? "Drag to reorder. The starred photo is shown first. JPG, PNG or WebP up to 5 MB." : "Product photos."}</p></div>
        {canEdit && <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload photos" onChange={(e) => void upload(e.target.files)} />
          <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {busy ? "Uploading…" : "Upload photos"}</Button>
        </>}
      </div>
      {images.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No photos yet.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} draggable={canEdit} onDragStart={() => { dragId.current = img.id; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, img.id)}
              className="group relative overflow-hidden rounded-xl border bg-muted">
              <img src={img.url} alt={`${product.name} photo ${i + 1}`} className="aspect-square w-full object-cover" />
              {img.id === primaryId && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Main</span>}
              {canEdit && <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/90 p-1.5">
                <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Set as main photo" disabled={img.id === primaryId} onClick={() => void saveOrder(images, img.id)}><Star className="size-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Delete photo" onClick={() => void remove(img)}><Trash2 className="size-4" /></Button>
                </div>
              </div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
