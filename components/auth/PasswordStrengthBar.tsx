'use client';

import type { PasswordStrength } from '@/lib/validation';

interface PasswordStrengthBarProps {
  strength: PasswordStrength;
}

export default function PasswordStrengthBar({ strength }: PasswordStrengthBarProps) {
  return (
    <div id="password-strength" className="mt-2">
      <div className="flex gap-1">
        <div className={`h-1 flex-1 rounded-full transition-colors ${strength === 'weak' ? 'bg-red-400' : strength === 'medium' ? 'bg-amber-400' : 'bg-teal-500'}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors ${strength === 'medium' ? 'bg-amber-400' : strength === 'strong' ? 'bg-teal-500' : 'bg-neutral-200'}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors ${strength === 'strong' ? 'bg-teal-500' : 'bg-neutral-200'}`} />
      </div>
      <p className={`text-xs mt-1 ${strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-amber-600' : 'text-teal-600'}`}>
        {strength === 'weak' ? 'Weak' : strength === 'medium' ? 'Medium' : 'Strong'} password
      </p>
    </div>
  );
}
