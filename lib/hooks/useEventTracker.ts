'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useSession } from './useSession';
import { ga4Calculation, ga4PaywallHit, ga4ProUpgrade } from '@/lib/ga4';

interface TrackEventOptions {
  immediate?: boolean; // Skip batching, send immediately
}

interface QueuedEvent {
  event_type: string;
  event_data: Record<string, unknown>;
  session_id: string;
  anonymous_id: string;
  timestamp: string;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 2000; // 2 seconds

export function useEventTracker() {
  const { sessionId, anonymousId } = useSession();
  const pendingEvents = useRef<QueuedEvent[]>([]);
  const flushTimeout = useRef<NodeJS.Timeout | null>(null);

  const flush = useCallback(async () => {
    if (pendingEvents.current.length === 0) return;

    const events = [...pendingEvents.current];
    pendingEvents.current = [];

    try {
      await fetch('/api/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true, // Ensure delivery even on page unload
      });
    } catch (error) {
      console.error('Failed to flush events:', error);
      // Re-queue failed events (but don't let queue grow unbounded)
      if (pendingEvents.current.length < 100) {
        pendingEvents.current = [...events, ...pendingEvents.current];
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flush, FLUSH_INTERVAL);
  }, [flush]);

  // Core tracking function
  const track = useCallback(
    (
      eventType: string,
      eventData: Record<string, unknown>,
      options: TrackEventOptions = {}
    ) => {
      if (!sessionId || !anonymousId) {
        console.warn('Session not initialized, event not tracked:', eventType);
        return;
      }

      const event: QueuedEvent = {
        event_type: eventType,
        event_data: eventData,
        session_id: sessionId,
        anonymous_id: anonymousId,
        timestamp: new Date().toISOString(),
      };

      if (options.immediate) {
        // Send immediately for critical events
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          keepalive: true,
        }).catch(console.error);
      } else {
        // Batch for non-critical events
        pendingEvents.current.push(event);

        if (pendingEvents.current.length >= BATCH_SIZE) {
          flush();
        } else {
          scheduleFlush();
        }
      }
    },
    [sessionId, anonymousId, flush, scheduleFlush]
  );

  // Specific tracking methods
  const trackCalculation = useCallback(
    (
      params: {
        modality: string;
        development_phase: string;
        indication_category?: string;
        indication_specific?: string;
        territory_scope?: string;
        deal_type?: string;
      },
      outputs: {
        upfront_low?: number;
        upfront_mid?: number;
        upfront_high?: number;
        milestones_total?: number;
        royalty_low?: number;
        royalty_high?: number;
        total_deal_value_low?: number;
        total_deal_value_high?: number;
      },
      iterationNumber: number = 1
    ) => {
      ga4Calculation(params.indication_category || params.modality, 'calculator');
      track(
        'calculation_completed',
        {
          ...params,
          outputs: {
            upfront_range: [outputs.upfront_low, outputs.upfront_high],
            milestones_total: outputs.milestones_total,
            royalty_range: [outputs.royalty_low, outputs.royalty_high],
            total_deal_value_range: [
              outputs.total_deal_value_low,
              outputs.total_deal_value_high,
            ],
          },
          iteration_number: iterationNumber,
        },
        { immediate: true }
      );
    },
    [track]
  );

  const trackParameterChange = useCallback(
    (
      parameterName: string,
      oldValue: string | string[] | undefined,
      newValue: string | string[]
    ) => {
      track('parameter_changed', {
        parameter_name: parameterName,
        old_value: oldValue,
        new_value: newValue,
      });
    },
    [track]
  );

  const trackPaywallHit = useCallback(
    (
      trigger: 'export' | 'comparable_deals' | 'pdf_report' | 'calculation_limit',
      calculationContext?: {
        modality: string;
        phase: string;
        indication?: string;
      }
    ) => {
      ga4PaywallHit(trigger);
      track(
        'paywall_displayed',
        {
          trigger,
          calculation_context: calculationContext,
        },
        { immediate: true }
      );
    },
    [track]
  );

  const trackPaywallDismissed = useCallback(() => {
    track('paywall_dismissed', {});
  }, [track]);

  const trackProFeatureClick = useCallback(
    (
      feature:
        | 'export_excel'
        | 'export_pdf'
        | 'comparable_deals'
        | 'saved_scenarios'
        | 'team_sharing',
      context: string
    ) => {
      track(
        'pro_feature_clicked',
        {
          feature,
          context,
        },
        { immediate: true }
      );
    },
    [track]
  );

  const trackUpgradeCtaClick = useCallback(
    (source: string) => {
      ga4ProUpgrade(source);
      track('upgrade_cta_clicked', { source }, { immediate: true });
    },
    [track]
  );

  const trackOutputSectionViewed = useCallback(
    (
      calculationId: string,
      section: 'upfront' | 'milestones' | 'royalties' | 'total_value' | 'comparable_deals',
      durationMs: number,
      scrollDepthPercent: number
    ) => {
      track('output_section_viewed', {
        calculation_id: calculationId,
        section,
        duration_ms: durationMs,
        scroll_depth_percent: scrollDepthPercent,
      });
    },
    [track]
  );

  const trackResultsCopied = useCallback(
    (calculationId: string) => {
      track('results_copied', { calculation_id: calculationId });
    },
    [track]
  );

  const trackExportAttempted = useCallback(
    (format: 'excel' | 'pdf') => {
      track('export_attempted', { format }, { immediate: true });
    },
    [track]
  );

  // Flush on visibility change and page unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    const handleBeforeUnload = () => {
      flush();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
      // Final flush on unmount
      flush();
    };
  }, [flush]);

  return {
    track,
    trackCalculation,
    trackParameterChange,
    trackPaywallHit,
    trackPaywallDismissed,
    trackProFeatureClick,
    trackUpgradeCtaClick,
    trackOutputSectionViewed,
    trackResultsCopied,
    trackExportAttempted,
    flush,
  };
}
