'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionData {
  valid: boolean;
  email: string;
  plan: string;
  customerName: string;
}

// ---------------------------------------------------------------------------
// Engine definitions
// ---------------------------------------------------------------------------

const ENGINES: { name: string; description: string; icon: string }[] = [
  { name: 'Deal Terms', description: 'Benchmark upfront, milestones, and royalties across 2,500+ deals', icon: 'handshake' },
  { name: 'rNPV', description: 'Risk-adjusted NPV with phase-specific LoA and discount rates', icon: 'chart-line' },
  { name: 'Monte Carlo', description: '10,000-iteration probabilistic simulation with confidence intervals', icon: 'dice' },
  { name: 'Sensitivity Analysis', description: 'Tornado charts isolating key value drivers', icon: 'sliders' },
  { name: 'Partner Matching', description: '850+ biopharma companies scored by strategic fit', icon: 'network' },
  { name: 'Competitive Landscape', description: 'Pipeline density, mechanism clustering, and white-space analysis', icon: 'radar' },
  { name: 'Market Sizing', description: 'TAM/SAM/SOM with epidemiology-driven bottom-up models', icon: 'globe' },
  { name: 'Scenario Planner', description: 'Side-by-side comparison of deal structures and outcomes', icon: 'layers' },
  { name: 'Deal Waterfall', description: 'Visualize milestone triggers and cumulative value over time', icon: 'waterfall' },
  { name: 'Real Options', description: 'CRR lattice valuation capturing optionality in staged deals', icon: 'tree' },
  { name: 'Competitive Dynamics', description: 'Game-theoretic modeling of competitor positioning', icon: 'chess' },
  { name: 'Lifecycle Extensions', description: 'Line extension, reformulation, and geographic expansion value', icon: 'cycle' },
  { name: 'Buyer-Specific Valuation', description: 'Tailored valuations based on acquirer synergies and portfolio', icon: 'target' },
  { name: 'Index Drug Comparison', description: 'Head-to-head benchmarking against reference compounds', icon: 'compare' },
];

// ---------------------------------------------------------------------------
// SVG Icon component (inline, no external deps)
// ---------------------------------------------------------------------------

function EngineIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || 'w-6 h-6';
  const shared = { className: cls, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', strokeWidth: 1.5 };

  switch (icon) {
    case 'handshake':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>;
    case 'chart-line':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>;
    case 'dice':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" /></svg>;
    case 'sliders':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>;
    case 'network':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>;
    case 'radar':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.981 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.789M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>;
    case 'globe':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
    case 'layers':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" /></svg>;
    case 'waterfall':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>;
    case 'tree':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
    case 'chess':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>;
    case 'cycle':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>;
    case 'target':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'compare':
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>;
    default:
      return <svg {...shared}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  }
}

// ---------------------------------------------------------------------------
// Confetti / Particle canvas
// ---------------------------------------------------------------------------

function useConfetti(canvasRef: React.RefObject<HTMLCanvasElement | null>, trigger: boolean) {
  useEffect(() => {
    if (!trigger || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; decay: number; rotation: number; rotationSpeed: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#2dd4bf', '#06b6d4', '#22d3ee', '#a5f3fc', '#5eead4', '#99f6e4', '#67e8f9', '#ffffff'];

    // Burst particles from top-center
    for (let i = 0; i < 120; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2 + Math.random() * 6;
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.15 + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.005 + Math.random() * 0.008,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter(p => p.alpha > 0);
      if (particles.length === 0) {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', resize);
        return;
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.vx *= 0.99;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }

      animId = requestAnimationFrame(animate);
    };

    // Short delay so it fires after the hero animates in
    const timeout = setTimeout(() => {
      animId = requestAnimationFrame(animate);
    }, 600);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [trigger, canvasRef]);
}

// ---------------------------------------------------------------------------
// Shimmer background particles
// ---------------------------------------------------------------------------

function ShimmerParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dots: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 40; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.3,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 191, ${d.alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Animated Checkmark
// ---------------------------------------------------------------------------

function AnimatedCheckmark({ show }: { show: boolean }) {
  return (
    <div className={`relative inline-flex items-center justify-center w-20 h-20 transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-400/20 animate-pulse" />
      {/* Circle */}
      <div className="absolute inset-1 rounded-full border-2 border-teal-400/40" />
      {/* Inner circle with gradient */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
        <svg
          className={`w-8 h-8 text-white transition-all duration-500 delay-300 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            className={show ? 'animate-draw-check' : ''}
            style={{
              strokeDasharray: 24,
              strokeDashoffset: show ? 0 : 24,
              transition: 'stroke-dashoffset 0.5s ease-out 0.5s',
            }}
          />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    }>
      <WelcomePageInner />
    </Suspense>
  );
}

function WelcomePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user, updateUser, isLoading: authLoading, setTier } = useAuth();

  const sessionId = searchParams.get('session_id');

  // State
  const [verifying, setVerifying] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [heroVisible, setHeroVisible] = useState(false);
  const [enginesVisible, setEnginesVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [confettiReady, setConfettiReady] = useState(false);

  // Profile form
  const [profileName, setProfileName] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Auth form (for unauthenticated users)
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading2, setAuthLoading2] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  useConfetti(confettiCanvasRef, confettiReady);

  // Pre-fill profile from user context
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileCompany(user.company || '');
      setProfileTitle(user.title || '');
    }
  }, [user]);

  // Pre-fill auth email from session
  useEffect(() => {
    if (sessionData?.email && !authEmail) {
      setAuthEmail(sessionData.email);
    }
  }, [sessionData, authEmail]);

  // Verify Stripe session
  useEffect(() => {
    if (!sessionId) {
      setVerifying(false);
      setVerifyError('No payment session found. If you recently subscribed, please check your email for confirmation.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.success && data.valid) {
          setSessionData(data);
          setVerifyError('');
        } else {
          setVerifyError(data.error || 'Unable to verify payment. Please contact support.');
        }
      } catch {
        setVerifyError('Unable to verify payment. Please check your connection and try again.');
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [sessionId]);

  // Cascade animations after verification
  useEffect(() => {
    if (verifying || verifyError) return;

    const t1 = setTimeout(() => setHeroVisible(true), 100);
    const t2 = setTimeout(() => setConfettiReady(true), 300);
    const t3 = setTimeout(() => setEnginesVisible(true), 800);
    const t4 = setTimeout(() => setProfileVisible(true), 1400);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [verifying, verifyError]);

  // Set tier to pro after successful verification
  useEffect(() => {
    if (sessionData?.valid && sessionData.plan === 'pro') {
      setTier('pro');
    }
  }, [sessionData, setTier]);

  // Profile save handler
  const handleProfileSave = useCallback(() => {
    if (!profileName.trim()) return;
    updateUser({
      name: profileName.trim(),
      company: profileCompany.trim() || undefined,
      title: profileTitle.trim() || undefined,
    });

    // Also update Supabase profile if authenticated
    if (isAuthenticated && user?.id && isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        supabase.from('user_profiles').update({
          company_name: profileCompany.trim() || null,
          job_title: profileTitle.trim() || null,
        }).eq('id', user.id).then(() => {});
      }
    }

    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }, [profileName, profileCompany, profileTitle, updateUser, isAuthenticated, user?.id]);

  // Inline auth handlers
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    setAuthLoading2(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/welcome${sessionId ? `?session_id=${sessionId}` : ''}`,
      },
    });
    if (error) {
      setAuthError('Failed to sign in with Google. Please try again.');
      setAuthLoading2(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!authEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (!authPassword || authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    setAuthLoading2(true);

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { name: authName || authEmail.split('@')[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setAuthError(error.message.includes('already registered')
            ? 'An account with this email already exists. Try signing in instead.'
            : error.message);
          setAuthLoading2(false);
          return;
        }
        if (data.user && !data.user.confirmed_at) {
          setAuthSuccess('Verification email sent. Check your inbox to complete signup.');
          setAuthLoading2(false);
          return;
        }
        // Auto-signed in
        setAuthSuccess('Account created successfully.');
      }
    }
    setAuthLoading2(false);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!authEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    setAuthLoading2(true);

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          setAuthError(error.message.includes('Invalid login')
            ? 'Invalid email or password.'
            : error.message);
          setAuthLoading2(false);
          return;
        }
        setAuthSuccess('Signed in successfully.');
      }
    }
    setAuthLoading2(false);
  };

  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading state
  if (verifying || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-4 text-sm">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (verifyError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Verification Issue</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">{verifyError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/calculator')}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Go to Calculator
            </button>
            <a
              href="mailto:support@ambrosiaventures.co"
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-sm font-medium transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Confetti overlay */}
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-50"
        aria-hidden="true"
      />

      {/* Ambient gradient blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-teal-500/8 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* ================================================================= */}
        {/* SECTION 1: Hero                                                    */}
        {/* ================================================================= */}
        <section className={`text-center mb-16 sm:mb-24 transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative inline-block mb-8">
            <ShimmerParticles />
            <AnimatedCheckmark show={heroVisible} />
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Ambrosia Pro
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            You now have full access to institutional-grade deal intelligence.
            14 analytical engines, 2,500+ benchmarked transactions, and unlimited analyses.
          </p>

          {sessionData?.email && (
            <p className="mt-4 text-sm text-slate-500">
              Subscribed as {sessionData.email}
            </p>
          )}
        </section>

        {/* ================================================================= */}
        {/* SECTION 2: What You Unlocked                                       */}
        {/* ================================================================= */}
        <section className={`mb-16 sm:mb-24 transition-all duration-1000 delay-200 ${enginesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-10">
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">What You Unlocked</h2>
            <p className="text-slate-400 text-sm">All 14 engines are now available without limits</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {ENGINES.map((engine, i) => (
              <div
                key={engine.name}
                className="group relative bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 sm:p-5 hover:border-teal-500/30 hover:bg-slate-900/80 transition-all duration-300"
                style={{
                  opacity: enginesVisible ? 1 : 0,
                  transform: enginesVisible ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity 0.5s ease-out ${i * 60 + 100}ms, transform 0.5s ease-out ${i * 60 + 100}ms`,
                }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-500/0 to-cyan-500/0 group-hover:from-teal-500/5 group-hover:to-cyan-500/5 transition-all duration-300" />

                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center mb-3 text-teal-400 group-hover:text-teal-300 transition-colors">
                    <EngineIcon icon={engine.icon} className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  </div>
                  <h3 className="text-white font-medium text-sm mb-1">{engine.name}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed hidden sm:block">{engine.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECTION 3: Auth (if not authenticated)                             */}
        {/* ================================================================= */}
        {!isAuthenticated && (
          <section className={`mb-16 sm:mb-24 transition-all duration-1000 delay-300 ${profileVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="max-w-md mx-auto">
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    {authMode === 'signup' ? 'Create Your Account' : 'Sign In'}
                  </h2>
                  <p className="text-slate-400 text-sm">
                    {authMode === 'signup'
                      ? 'Link your subscription to an account to access Pro features'
                      : 'Sign in to link your Pro subscription'}
                  </p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{authError}</p>
                  </div>
                )}

                {authSuccess && (
                  <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                    <p className="text-teal-300 text-sm">{authSuccess}</p>
                  </div>
                )}

                {/* Google OAuth */}
                {isSupabaseConfigured() && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading2}
                      className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-750 hover:border-slate-600 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-medium text-slate-200">
                        {authMode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                      </span>
                    </button>

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-slate-900/60 text-slate-500 text-xs">or continue with email</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Email form */}
                <form onSubmit={authMode === 'signup' ? handleEmailSignUp : handleEmailSignIn}>
                  {authMode === 'signup' && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        placeholder="Dr. Jane Smith"
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                      />
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                      required
                    />
                  </div>
                  <div className="mb-5">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      placeholder={authMode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading2}
                    className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {authLoading2 ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                    )}
                  </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500">
                  {authMode === 'signup' ? (
                    <>Already have an account?{' '}
                      <button onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess(''); }} className="text-teal-400 font-medium hover:underline">Sign in</button>
                    </>
                  ) : (
                    <>Need an account?{' '}
                      <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess(''); }} className="text-teal-400 font-medium hover:underline">Create one</button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* SECTION 4: Profile (if authenticated)                              */}
        {/* ================================================================= */}
        {isAuthenticated && (
          <section className={`mb-16 sm:mb-24 transition-all duration-1000 delay-300 ${profileVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="max-w-md mx-auto">
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 sm:p-8">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-white mb-1">Complete Your Profile</h2>
                  <p className="text-slate-400 text-sm">Help us tailor your experience</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Company</label>
                    <input
                      type="text"
                      value={profileCompany}
                      onChange={e => setProfileCompany(e.target.value)}
                      placeholder="Pfizer, Novartis, BridgeBio..."
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={profileTitle}
                      onChange={e => setProfileTitle(e.target.value)}
                      placeholder="VP Business Development, Director BD&L..."
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/40 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleProfileSave}
                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-300 ${
                      profileSaved
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {profileSaved ? 'Profile Saved' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* SECTION 5: CTA                                                     */}
        {/* ================================================================= */}
        <section className={`text-center pb-12 transition-all duration-1000 delay-500 ${profileVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <button
            onClick={() => router.push('/calculator')}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-base sm:text-lg rounded-xl transition-all duration-300 shadow-xl shadow-teal-500/25 hover:shadow-teal-400/35 hover:scale-[1.02]"
          >
            <span>Launch Your First Analysis</span>
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>

          <p className="mt-4 text-slate-500 text-xs">
            All 14 engines unlocked. Unlimited analyses. Cancel anytime.
          </p>
        </section>
      </div>

      {/* CSS for custom animations */}
      <style jsx>{`
        @keyframes draw-check {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        .animate-draw-check {
          animation: draw-check 0.5s ease-out 0.5s forwards;
        }
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to));
        }
      `}</style>
    </div>
  );
}
