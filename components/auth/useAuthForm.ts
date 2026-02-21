'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  validateEmail as checkEmail,
  validatePassword as checkPassword,
  validateName as checkName,
  getPasswordStrength,
  type PasswordStrength,
} from '@/lib/validation';

export interface AuthFormState {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  acceptTerms: boolean;
  setAcceptTerms: (v: boolean) => void;
  magicLinkMode: boolean;
  setMagicLinkMode: (v: boolean) => void;
  touched: Record<string, boolean>;
  fieldErrors: Record<string, string | undefined>;
  passwordStrength: PasswordStrength;
  handleBlur: (field: string) => void;
  reset: () => void;
}

export function useAuthForm(): AuthFormState {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    let result;
    switch (field) {
      case 'name': result = checkName(name); break;
      case 'email': result = checkEmail(email); break;
      case 'password': result = checkPassword(password); break;
      case 'confirmPassword':
        result = password !== confirmPassword
          ? { valid: false, message: 'Passwords do not match' }
          : { valid: true };
        break;
      default: return;
    }
    setFieldErrors(prev => ({ ...prev, [field]: result.valid ? undefined : result.message }));
  }, [name, email, password, confirmPassword]);

  // Update password strength as user types
  useEffect(() => {
    if (password) setPasswordStrength(getPasswordStrength(password));
  }, [password]);

  const reset = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setCompany('');
    setShowPassword(false);
    setAcceptTerms(false);
    setMagicLinkMode(false);
    setTouched({});
    setFieldErrors({});
    setPasswordStrength('weak');
  }, []);

  return {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    name, setName,
    company, setCompany,
    showPassword, setShowPassword,
    acceptTerms, setAcceptTerms,
    magicLinkMode, setMagicLinkMode,
    touched,
    fieldErrors,
    passwordStrength,
    handleBlur,
    reset,
  };
}
