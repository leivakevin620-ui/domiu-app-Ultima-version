'use client';
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, CheckCircle2, Clock, AlertCircle, Shield, Eye } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import { uploadCourierDocumentAction } from '@/app/actions/courier-profile';

interface DocEntry {
  key: string;
  label: string;
  required: boolean;
}

const REQUIRED_DOCS: DocEntry[] = [
  { key: 'cedula', label: 'Cédula', required: true },
  { key: 'license', label: 'Licencia', required: true },
  { key: 'soat', label: 'SOAT', required: true },
  { key: 'tecnomecanica', label: 'Tecnomecánica', required: true },
];

function getStatus(url: string | undefined, key: string): { label: string; icon: React.ElementType; color: string } {
  if (!url) return { label: 'No subido', icon: AlertCircle, color: 'text-red-400' };
  if (key === 'license' && !url.includes('verified')) return { label: 'Pendiente', icon: Clock, color: 'text-amber-400' };
  return { label: 'Verificado', icon: CheckCircle2, color: 'text-emerald-400' };
}

function getStatusBg(key: string, url: string | undefined): string {
  if (!url) return 'border-red-500/20 bg-red-500/5';
  if (key === 'license' && !url?.includes('verified')) return 'border-amber-500/20 bg-amber-500/5';
  return 'border-emerald-500/20 bg-emerald-500/5';
}

export function DocumentsProCard() {
  const { courier, refresh } = useCourier();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const metadata = courier?.metadata || {};
  const documents: Record<string, string> = (metadata?.documents as Record<string, string>) || {};

  const handleUpload = async (docKey: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = 'image/*,application/pdf';
    input.value = '';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !courier?.id) return;

      setUploading(docKey);
      const formData = new FormData();
      formData.append('document', file);
      formData.append('docType', docKey);

      await uploadCourierDocumentAction(courier.id, formData);
      setUploading(null);
      refresh();
    };

    input.click();
  };

  const isUploading = (key: string) => uploading === key;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 shadow-lg"
    >
      <input ref={fileInputRef} type="file" className="hidden" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Documentos</p>
          <h3 className="text-lg font-black text-white">Archivos subidos</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
          <Shield className="h-5 w-5 text-violet-400" />
        </div>
      </div>

      <div className="space-y-2">
        {REQUIRED_DOCS.map((doc) => {
          const url = documents[doc.key];
          const status = getStatus(url, doc.key);
          const StatusIcon = status.icon;
          const bgBorder = getStatusBg(doc.key, url);

          return (
            <div
              key={doc.key}
              className={`flex items-center gap-3 rounded-xl border ${bgBorder} p-3 transition hover:bg-white/[0.07]`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <FileText className="h-4 w-4 text-white/70" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">
                  {doc.label}
                  {doc.required && <span className="ml-1 text-[10px] text-red-400">*</span>}
                </p>
                <div className="flex items-center gap-1">
                  <StatusIcon className={`h-3 w-3 ${status.color}`} />
                  <span className={`text-[10px] font-semibold ${status.color}`}>
                    {isUploading(doc.key) ? 'Subiendo...' : status.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/50 transition hover:bg-white/20 hover:text-white"
                    aria-label={`Ver ${doc.label}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleUpload(doc.key)}
                  disabled={isUploading(doc.key)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[10px] font-bold text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {url ? 'Re-subir' : 'Subir'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] font-medium text-slate-500">
        Formatos aceptados: JPG, PNG, PDF. Máx 5MB por archivo.
      </p>
    </motion.section>
  );
}
