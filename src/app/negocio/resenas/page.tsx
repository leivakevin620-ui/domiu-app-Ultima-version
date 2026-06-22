'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from '@/components/ui/page-container';
import { PageTitle } from '@/components/ui/page-title';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { reviewService, type ReviewWithAuthor, type BusinessStats } from '@/services/reviews';
import { Star, MessageSquare, Calendar } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

type Business = Database['public']['Tables']['businesses']['Row'];

export default function NegocioResenas() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondText, setRespondText] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    fetch(`/api/profile?userId=${profile.id}`)
      .then((res) => res.json())
      .then((bizData) => {
        const businesses = Array.isArray(bizData) ? (bizData as Business[]) : [];
        const biz = businesses.find((b) => b.owner_id === profile.id!) ?? businesses[0];
        if (!biz) return;
        return Promise.all([
          reviewService.getBusinessStats(biz.id),
          reviewService.getBusinessReviews(biz.id),
        ]);
      })
      .then((result) => {
        if (result) {
          setStats(result[0]);
          setReviews(result[1]);
        }
      })
      .catch((e) => logger.error('Error loading reviews', e))
      .finally(() => setLoading(false));
  }, [profile?.id, refreshKey]);

  const handleRespond = async (reviewId: string) => {
    if (!respondText[reviewId]?.trim()) return;
    setResponding((p) => ({ ...p, [reviewId]: true }));
    try {
      await reviewService.respondToReview(reviewId, profile!.id, respondText[reviewId]);
      setRespondText((p) => ({ ...p, [reviewId]: '' }));
      setRefreshKey((k) => k + 1);
    } catch (e) {
      logger.error('Error responding to review', e);
    }
    setResponding((p) => ({ ...p, [reviewId]: false }));
  };

  if (loading) return <SkeletonCard />;

  return (
    <PageContainer>
      <PageTitle title="Reseñas" description="Opiniones de tus clientes" />

      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard icon={<Star className="h-5 w-5" />} label="Rating Promedio" value={stats?.avg_rating.toFixed(1) ?? '0'} />
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Calificaciones" value={String(stats?.total_ratings ?? 0)} />
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Reseñas con comentario" value={String(stats?.total_reviews ?? 0)} />
      </div>

      {reviews.length === 0 ? (
        <DashboardCard title="Reseñas Recibidas">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no tienes reseñas</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Las reseñas de tus clientes aparecerán aquí</p>
          </div>
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {review.author_name.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{review.author_name}</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(review.created_at).toLocaleDateString('es-MX')}
                </span>
              </div>

              {review.review && (
                <p className="mb-3 text-sm text-muted-foreground">{review.review}</p>
              )}

              {review.response ? (
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary">Tu respuesta:</p>
                  <p className="mt-1 text-sm text-foreground">{review.response}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={respondText[review.id] ?? ''}
                    onChange={(e) => setRespondText((p) => ({ ...p, [review.id]: e.target.value }))}
                    placeholder="Responder a esta reseña..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    maxLength={500}
                  />
                  <button
                    onClick={() => handleRespond(review.id)}
                    disabled={!respondText[review.id]?.trim() || responding[review.id]}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {responding[review.id] ? '...' : 'Responder'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
