export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: false, message: 'Email is required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, message: 'Password is required' };
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  return { valid: true };
}

export function validateName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, message: 'Name is required' };
  if (name.trim().length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  return { valid: true };
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 8) return 'weak';

  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score >= 4) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
}
