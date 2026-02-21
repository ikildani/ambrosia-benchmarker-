'use client';

import { useRef, useEffect, useState } from 'react';

interface TabTransitionProps {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}

export default function TabTransition({ activeKey, children, className }: TabTransitionProps) {
  const prevKeyRef = useRef(activeKey);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prevKeyRef.current !== activeKey) {
      prevKeyRef.current = activeKey;
      setAnimating(true);

      const timer = setTimeout(() => {
        setAnimating(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [activeKey]);

  return (
    <div
      className={`${animating ? 'animate-tab-content' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
