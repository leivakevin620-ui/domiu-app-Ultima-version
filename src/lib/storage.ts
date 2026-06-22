import { getBrowserClient } from '@/lib/db/supabase';

export const STORAGE_BUCKETS = {
  BUSINESS_LOGOS: 'business-logos',
  BUSINESS_BANNERS: 'business-banners',
  PRODUCT_IMAGES: 'product-images',
  AVATARS: 'user-avatars',
  CHAT_FILES: 'chat-files',
  RATINGS_IMAGES: 'ratings-images',
  PROMOTIONS: 'promotions',
  CATEGORIES: 'categories',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export interface UploadResult {
  url: string | null;
  path: string | null;
  error: string | null;
}

function getBucket(bucket: StorageBucket): string {
  return bucket;
}

export const storageService = {
  async upload(
    bucket: StorageBucket,
    file: File,
    folder = 'general'
  ): Promise<UploadResult> {
    try {
      const supabase = getBrowserClient();
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from(getBucket(bucket))
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        return { url: null, path: null, error: error.message };
      }

      const { data: urlData } = supabase.storage
        .from(getBucket(bucket))
        .getPublicUrl(data.path);

      return { url: urlData.publicUrl, path: data.path, error: null };
    } catch (err) {
      return { url: null, path: null, error: err instanceof Error ? err.message : 'Error al subir archivo' };
    }
  },

  async replace(
    bucket: StorageBucket,
    file: File,
    oldPath: string | null,
    folder = 'general'
  ): Promise<UploadResult> {
    if (oldPath) {
      await this.delete(bucket, oldPath);
    }
    return this.upload(bucket, file, folder);
  },

  async delete(bucket: StorageBucket, path: string): Promise<string | null> {
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.storage
        .from(getBucket(bucket))
        .remove([path]);

      if (error) {
        return error.message;
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Error al eliminar archivo';
    }
  },

  async list(bucket: StorageBucket, folder = ''): Promise<{ name: string; url: string }[]> {
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.storage
        .from(getBucket(bucket))
        .list(folder);

      if (error || !data) return [];

      return (data as Array<{ id: string | null; name: string }>)
        .filter((item) => !item.id) // solo archivos, no carpetas
        .map((item) => {
          const { data: urlData } = supabase.storage
            .from(getBucket(bucket))
            .getPublicUrl(`${folder ? folder + '/' : ''}${item.name}`);
          return { name: item.name, url: urlData.publicUrl };
        });
    } catch {
      return [];
    }
  },

  getPublicUrl(bucket: StorageBucket, path: string): string | null {
    try {
      const supabase = getBrowserClient();
      const { data } = supabase.storage
        .from(getBucket(bucket))
        .getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  },
};
