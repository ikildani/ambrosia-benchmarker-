'use client';

import dynamic from 'next/dynamic';

// Loaded when opened: the modal carries the Supabase auth client (48 KB gz).
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
import { useAuth } from '@/contexts/AuthContext';

export default function AuthModalGlobal() {
  const { showAuthModal, closeAuthModal, authModalMode } = useAuth();

  return (
    <AuthModal
      isOpen={showAuthModal}
      onClose={closeAuthModal}
      onSuccess={closeAuthModal}
      initialMode={authModalMode}
    />
  );
}
