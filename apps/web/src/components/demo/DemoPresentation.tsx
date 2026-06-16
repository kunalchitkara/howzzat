"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SLIDES_HTML } from "./slides-content";
import "./demo-presentation.css";

const ANIMATION_MS = 500;

export function DemoPresentation() {
  const slidesRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const currentRef = useRef(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchXRef = useRef(0);

  const getSlides = useCallback(() => {
    if (!slidesRef.current) return [];
    return Array.from(slidesRef.current.querySelectorAll<HTMLElement>(".slide"));
  }, []);

  const updateChrome = useCallback(
    (index: number, slideCount: number) => {
      const pct = slideCount > 0 ? ((index + 1) / slideCount) * 100 : 0;
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
      const slides = getSlides();
      const title = slides[index]?.dataset.title ?? "Slide";
      document.title = `${title} — Howzzat Demo`;
    },
    [getSlides],
  );

  const goTo = useCallback(
    (index: number, direction: number) => {
      const slides = getSlides();
      const cur = currentRef.current;
      if (index < 0 || index >= slides.length || index === cur) return;

      const prev = slides[cur];
      const next = slides[index];
      prev.classList.remove("active");
      if (direction > 0) prev.classList.add("exit-left");
      next.classList.add("active");
      currentRef.current = index;
      setCurrent(index);
      updateChrome(index, slides.length);

      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => prev.classList.remove("exit-left"), ANIMATION_MS);
    },
    [getSlides, updateChrome],
  );

  const next = useCallback(() => goTo(currentRef.current + 1, 1), [goTo]);
  const prev = useCallback(() => goTo(currentRef.current - 1, -1), [goTo]);

  useEffect(() => {
    const slides = getSlides();
    setTotal(slides.length);
    updateChrome(0, slides.length);
  }, [getSlides, updateChrome]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        goTo(0, -1);
      } else if (e.key === "End") {
        goTo(getSlides().length - 1, 1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchXRef.current = e.touches[0]?.clientX ?? 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchXRef.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) next();
        else prev();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [next, prev, goTo, getSlides]);

  return (
    <div className="demo-presentation-root">
      <div className="deck" id="deck">
        <div className="logo-mark">HOWZZAT</div>
        <div className="progress">
          <div className="progress-bar" id="progress" ref={progressRef} />
        </div>
        <div className="counter" id="counter">
          {total > 0 ? `${current + 1} / ${total}` : "…"}
        </div>
        <div className="hint">← → navigate · Space next · Click sides</div>
        <div className="mobile-hint">Swipe ← → · Tap sides</div>

        {total > 0 && (
          <div className="progress-dots" aria-label="Slide progress">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`progress-dot${i === current ? " active" : ""}`}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current ? "step" : undefined}
                onClick={() => goTo(i, i > current ? 1 : -1)}
              />
            ))}
          </div>
        )}

        <div
          className="nav-zone prev"
          id="prevZone"
          aria-label="Previous slide"
          onClick={prev}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              prev();
            }
          }}
        />
        <div
          className="nav-zone next"
          id="nextZone"
          aria-label="Next slide"
          onClick={next}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              next();
            }
          }}
        />

        <div
          className="slides"
          id="slides"
          ref={slidesRef}
          dangerouslySetInnerHTML={{ __html: SLIDES_HTML }}
        />
      </div>
    </div>
  );
}
