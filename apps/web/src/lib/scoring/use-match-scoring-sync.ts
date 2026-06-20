"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { apiFetch } from "@/lib/client/api";
import type { RecordDeliveryResponse } from "@/lib/scoring/delivery-response";
import {
  applyServerAck,
  hasFailedDeliveries,
  hasPendingDeliveries,
  hasUnsyncedDeliveries,
  markDeliveryFailed,
  markDeliveryInflight,
  type MatchScoringStoreState,
} from "@/lib/scoring/match-scoring-store";

const FLUSH_DEBOUNCE_MS = 2500;

export interface FlushScoringQueueOptions {
  storeOverride?: MatchScoringStoreState;
  onInningsComplete?: () => void;
  onChaseTargetReached?: () => void;
}

/** Drains pending deliveries; optional storeOverride avoids stale ref before React re-render. */
export async function flushScoringQueue(
  storeRef: { current: MatchScoringStoreState },
  setStore: Dispatch<SetStateAction<MatchScoringStoreState>>,
  options?: FlushScoringQueueOptions,
): Promise<void> {
  if (options?.storeOverride) {
    storeRef.current = options.storeOverride;
  }

  while (true) {
    const current = storeRef.current;
    const next = current.pendingQueue.find(
      (p) => p.status === "pending" || p.status === "failed",
    );
    if (!next) break;

    if (next.status === "failed") {
      const reset = {
        ...current,
        pendingQueue: current.pendingQueue.map((p) =>
          p.clientDeliveryId === next.clientDeliveryId
            ? { ...p, status: "pending" as const, error: undefined }
            : p,
        ),
        syncStatus: "saving" as const,
        syncError: null,
      };
      storeRef.current = reset;
      setStore(reset);
    }

    const inflight = markDeliveryInflight(storeRef.current, next.clientDeliveryId);
    storeRef.current = inflight;
    setStore(inflight);

    try {
      const ack = await apiFetch<RecordDeliveryResponse>("/api/v1/deliveries", {
        method: "POST",
        body: JSON.stringify(next.payload),
      });
      setStore((s) => {
        const acked = applyServerAck(s, next.clientDeliveryId, ack);
        storeRef.current = acked;
        return acked;
      });
      if (ack.innings.complete) {
        options?.onInningsComplete?.();
      }
      if (ack.chase?.targetReached) {
        options?.onChaseTargetReached?.();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(
        "[scoring-sync] delivery failed",
        next.clientDeliveryId,
        message,
      );
      setStore((s) => {
        const failed = markDeliveryFailed(s, next.clientDeliveryId, message);
        storeRef.current = failed;
        return failed;
      });
      break;
    }
  }
}

export function useMatchScoringSync(
  store: MatchScoringStoreState,
  setStore: Dispatch<SetStateAction<MatchScoringStoreState>>,
  options?: {
    onInningsComplete?: () => void;
    onChaseTargetReached?: () => void;
  },
) {
  const storeRef = useRef(store);
  storeRef.current = store;
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);

  const flushPending = useCallback(
    async (storeOverride?: MatchScoringStoreState) => {
      if (flushingRef.current) return;
      flushingRef.current = true;
      try {
        await flushScoringQueue(storeRef, setStore, {
          storeOverride,
          onInningsComplete: options?.onInningsComplete,
          onChaseTargetReached: options?.onChaseTargetReached,
        });
      } finally {
        flushingRef.current = false;
      }
    },
    [setStore, options],
  );

  const scheduleFlush = useCallback(
    (immediate = false, storeOverride?: MatchScoringStoreState) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (immediate) {
        void flushPending(storeOverride);
        return;
      }
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        void flushPending();
      }, FLUSH_DEBOUNCE_MS);
    },
    [flushPending],
  );

  const awaitQueueEmpty = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    await flushPending();
    while (hasPendingDeliveries(storeRef.current)) {
      await new Promise((r) => setTimeout(r, 50));
      await flushPending();
    }
    if (hasFailedDeliveries(storeRef.current)) {
      throw new Error(
        storeRef.current.syncError ??
          "Some scores failed to sync — tap Sync error to retry",
      );
    }
  }, [flushPending]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsyncedDeliveries(storeRef.current)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  return { scheduleFlush, flushPending, awaitQueueEmpty };
}
