import { logger } from './logger';

interface PageViewEvent {
  path: string;
  referrer: string;
  duration?: number;
  userId?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  tag?: string;
}

class Observability {
  private pageStart: number = 0;
  private enabled: boolean;

  constructor() {
    this.enabled = typeof window !== 'undefined' && process.env.NODE_ENV === 'production';
  }

  trackPageView(path: string, userId?: string) {
    this.pageStart = performance.now();
    const event: PageViewEvent = {
      path,
      referrer: document.referrer,
      userId,
    };
    logger.info('page_view', event);
  }

  trackPageLeave(path: string, userId?: string) {
    if (!this.pageStart) return;
    const duration = Math.round(performance.now() - this.pageStart);
    const event: PageViewEvent = {
      path,
      referrer: document.referrer,
      duration,
      userId,
    };
    logger.info('page_leave', event);
  }

  trackMetric(name: string, value: number, rating?: PerformanceMetric['rating'], tag?: string) {
    const metric: PerformanceMetric = {
      name,
      value,
      rating: rating ?? (value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'),
      tag,
    };
    logger.info('perf_metric', metric);
  }

  trackError(error: Error, context?: string) {
    logger.error(error.message, {
      name: error.name,
      stack: error.stack,
      context,
    });
  }
}

export const observability = new Observability();
