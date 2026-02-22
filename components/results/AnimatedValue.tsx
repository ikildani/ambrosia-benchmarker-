'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';

interface AnimatedValueProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Count-up animation that ticks from 0 to the target value.
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedValue({
  value,
  format = formatCurrency,
  duration = 800,
  className = '',
}: AnimatedValueProps) {
  const [display, setDisplay] = useState(format(0));
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || hasAnimatedRef.current) {
      setDisplay(format(value));
      return;
    }

    // Use IntersectionObserver to only animate when visible
    const el = elRef.current;
    if (!el) {
      setDisplay(format(value));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          observer.disconnect();
          startAnimation();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    function startAnimation() {
      startRef.current = null;

      const animate = (timestamp: number) => {
        if (startRef.current === null) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for natural deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * value);

        setDisplay(format(current));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setDisplay(format(value));
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, format, duration]);

  // When value changes after initial animation, just update immediately
  useEffect(() => {
    if (hasAnimatedRef.current) {
      setDisplay(format(value));
    }
  }, [value, format]);

  return (
    <span ref={elRef} className={`tabular-nums ${className}`}>
      {display}
    </span>
  );
}
