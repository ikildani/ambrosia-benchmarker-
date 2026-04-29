'use client';

import AuthModal from '@/components/AuthModal';
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
