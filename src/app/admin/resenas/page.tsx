'use client';

import React, { useEffect, useState } from 'react';
import { SkeletonCard } from '@/components/ui/skeleton';
import { reviewService } from '@/services/reviews';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Star, Trash2, AlertTriangle, Search, Flag } from 'lucide-react';

export default function AdminResenas() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reviews' | 'reports'>('reports');
  const [search, setSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [r, reps] = await Promise.all([
        reviewService.getAllReviewsAdmin(),
        reviewService.getAllReports(),
      ]);
      setReviews(r); setReports(reps);
    } catch (e) { logger.error('Error loading reviews', e); }
    setLoading(false);
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm('¿Eliminar esta reseña permanentemente?')) return;
    try { await reviewService.softDeleteReview(reviewId); loadAll(); }
    catch (e) { logger.error('Error deleting review', e); }
  };

  const handleDismissReport = async (reportId: string) => {
    try { await reviewService.updateReportStatus(reportId, 'dismissed', 'admin'); loadAll(); }
    catch (e) { logger.error('Error dismissing report', e); }
  };

  const handleApproveAndDelete = async (reportId: string, reviewId: string) => {
    if (!confirm('¿Eliminar la reseña reportada y marcar el reporte como revisado?')) return;
    try {
      await reviewService.softDeleteReview(reviewId);
      await reviewService.updateReportStatus(reportId, 'reviewed', 'admin');
      loadAll();
    } catch (e) { logger.error('Error approving review deletion', e); }
  };

  if (loading) return <SkeletonCard />;

  const filteredReviews = reviews.filter(
    (r) =>
      r.review?.toLowerCase().includes(search.toLowerCase()) ||
      r.profiles?.first_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const pendingReports = reports.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Reseñas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administra reseñas y reportes de la plataforma</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('reports')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'reports' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <span className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Reportes {pendingReports.length > 0 && `(${pendingReports.length})`}
          </span>
        </button>
        <button
          onClick={() => setTab('reviews')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'reviews' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Todas las reseñas ({reviews.length})
          </span>
        </button>
      </div>

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No hay reportes de reseñas</p>
            </div>
          ) : (
            reports.map((report) => {
              const review = report.ratings;
              return (
                <div key={report.id} className="rounded-2xl border border-border bg-card shadow-card p-5 hover:shadow-lg transition-all duration-200">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        report.status === 'pending' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Flag className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          Reportado por {report.profiles?.first_name ?? 'Anónimo'}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            report.status === 'pending' ? 'bg-destructive/10 text-destructive' :
                            report.status === 'reviewed' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          }`}>
                            {report.status}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Razón: {report.reason}{report.description && ` — ${report.description}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString('es-MX')}</span>
                  </div>
                  {review && (
                    <div className="mb-3 rounded-xl bg-muted/30 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-3 w-3 ${star <= Number(review.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">{review.rating_type}</span>
                      </div>
                      {review.review && <p className="text-sm text-foreground">{review.review}</p>}
                    </div>
                  )}
                  {report.status === 'pending' && review && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveAndDelete(report.id, review.id)} className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors">
                        Eliminar reseña
                      </button>
                      <button onClick={() => handleDismissReport(report.id)} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                        Descartar reporte
                      </button>
                    </div>
                  )}
                  {report.status !== 'pending' && (
                    <p className="text-xs text-muted-foreground">Revisado {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString('es-MX') : ''}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar reseñas..."
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            />
          </div>
          {filteredReviews.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No hay reseñas</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredReviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-border bg-card shadow-card p-4 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-sm font-bold text-primary">
                        {review.profiles?.first_name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{review.profiles?.first_name ?? 'Anónimo'} {review.profiles?.last_name ?? ''}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`h-3 w-3 ${star <= Number(review.rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] capitalize text-muted-foreground">{review.rating_type}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(review.id)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Eliminar reseña">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {review.review && <p className="mt-2 text-sm text-muted-foreground">{review.review}</p>}
                  <p className="mt-2 text-[10px] text-muted-foreground/60">{new Date(review.created_at).toLocaleDateString('es-MX')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
