'use client';

import React, { useState } from 'react';
import { reviewService } from '@/services/reviews';
import { Star, MessageSquare } from 'lucide-react';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerId: string;
  businessId: string;
  businessName: string;
  courierId?: string | null;
  courierName?: string | null;
  onSubmitted: () => void;
}

export function ReviewModal({
  open,
  onClose,
  orderId,
  customerId,
  businessId,
  businessName,
  courierId,
  courierName,
  onSubmitted,
}: ReviewModalProps) {
  const [step, setStep] = useState<'business' | 'courier' | 'done'>('business');
  const [businessRating, setBusinessRating] = useState(0);
  const [courierRating, setCourierRating] = useState(0);
  const [businessReview, setBusinessReview] = useState('');
  const [courierReview, setCourierReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmitBusiness = async () => {
    if (businessRating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await reviewService.createReview(
        orderId,
        customerId,
        businessId,
        'merchant',
        businessRating,
        businessReview || undefined,
      );
      if (courierId) {
        setStep('courier');
      } else {
        setStep('done');
        onSubmitted();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al enviar calificación');
    }
    setSubmitting(false);
  };

  const handleSubmitCourier = async () => {
    if (courierRating === 0) return;
    setSubmitting(true);
    setError('');
    try {
      await reviewService.createReview(
        orderId,
        customerId,
        courierId!,
        'courier',
        courierRating,
        courierReview || undefined,
      );
      setStep('done');
      onSubmitted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al enviar calificación');
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setStep('business');
    setBusinessRating(0);
    setCourierRating(0);
    setBusinessReview('');
    setCourierReview('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl sm:rounded-2xl">
        {step === 'business' && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">🍽️</div>
              <h2 className="text-lg font-bold text-foreground">¿Cómo fue tu experiencia?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Califica a <strong>{businessName}</strong></p>
            </div>

            <div className="mb-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setBusinessRating(star)}
                  className="transition-all duration-150 hover:scale-110 active:scale-90"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= businessRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={businessReview}
              onChange={(event) => setBusinessReview(event.target.value)}
              placeholder="Cuéntanos más sobre tu experiencia"
              className="mb-4 h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              maxLength={500}
            />

            {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={handleSubmitBusiness}
                disabled={businessRating === 0 || submitting}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Siguiente'}
              </button>
            </div>
          </>
        )}

        {step === 'courier' && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">🛵</div>
              <h2 className="text-lg font-bold text-foreground">¿Qué tal el repartidor?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Califica a <strong>{courierName}</strong></p>
            </div>

            <div className="mb-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCourierRating(star)}
                  className="transition-all duration-150 hover:scale-110 active:scale-90"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= courierRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={courierReview}
              onChange={(event) => setCourierReview(event.target.value)}
              placeholder="Cuéntanos cómo fue la entrega"
              className="mb-4 h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              maxLength={500}
            />

            {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={handleSubmitCourier}
                disabled={courierRating === 0 || submitting}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar calificación'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <MessageSquare className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-lg font-bold text-foreground">¡Gracias por tu opinión!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Tu calificación ayuda a mejorar la experiencia de todos.</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
