'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { storageService, type StorageBucket } from '@/lib/storage';
import { LogoPlaceholder, BusinessBannerPlaceholder, ProductPlaceholder, AvatarPlaceholder } from '@/components/ui/placeholders';
import { Upload, Trash2, Check, Loader2 } from 'lucide-react';

type PreviewType = 'logo' | 'banner' | 'product' | 'avatar';

interface StorageManagerProps {
  bucket: StorageBucket;
  previewType?: PreviewType;
  currentUrl?: string | null;
  currentPath?: string | null;
  folder?: string;
  onUploaded?: (url: string, path: string) => void;
  onDeleted?: () => void;
  className?: string;
}

const PREVIEW_MAP: Record<PreviewType, React.ComponentType<{ className?: string }>> = {
  logo: LogoPlaceholder,
  banner: BusinessBannerPlaceholder,
  product: ProductPlaceholder,
  avatar: AvatarPlaceholder,
};

export function StorageManager({
  bucket,
  previewType = 'product',
  currentUrl,
  currentPath,
  folder = 'general',
  onUploaded,
  onDeleted,
  className,
}: StorageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [storedPath, setStoredPath] = useState<string | null>(currentPath ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const PlaceholderComponent = PREVIEW_MAP[previewType];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);
    setUploading(true);

    const result = await storageService.replace(bucket, file, storedPath, folder);

    if (result.error) {
      setError(result.error);
    } else if (result.url && result.path) {
      setPreview(result.url);
      setStoredPath(result.path);
      setSuccess(true);
      onUploaded?.(result.url, result.path);
      setTimeout(() => setSuccess(false), 2000);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!storedPath) return;

    setError(null);
    setDeleting(true);

    const err = await storageService.delete(bucket, storedPath);

    if (err) {
      setError(err);
    } else {
      setPreview(null);
      setStoredPath(null);
      onDeleted?.();
    }

    setDeleting(false);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 transition-all duration-200 hover:border-primary/30">
        {preview ? (
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={preview}
              alt="Preview"
              fill
              sizes="400px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/0 transition-all duration-200 hover:bg-black/20" />
          </div>
        ) : (
          <div className="aspect-[4/3] w-full">
            <PlaceholderComponent className="h-full w-full rounded-none border-0" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 hover:opacity-100">
          <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/90 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-white hover:scale-105 active:scale-95">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </label>
          {storedPath && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/90 text-destructive-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-destructive hover:scale-105 active:scale-95"
            >
              {deleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Trash2 className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Subiendo...
        </div>
      )}

      {success && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="h-3 w-3" />
          Imagen guardada
        </div>
      )}
    </div>
  );
}
