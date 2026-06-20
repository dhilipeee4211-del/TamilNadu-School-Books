'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Mail, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if user is logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setAuthLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setStep('otp');
        setMessage({ type: 'success', text: 'One-Time Password (OTP) has been sent to your email.' });
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to send OTP. Please try again.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    setAuthLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
        router.push('/');
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ type: 'error', text: 'Verification failed. Please verify your OTP.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
        setAuthLoading(false);
      }
    } catch (err: unknown) {
      console.error(err);
      setMessage({ type: 'error', text: 'Google Login failed.' });
      setAuthLoading(false);
    }
  };

  if (loading || (user && !authLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-on-surface-variant animate-pulse">Establishing secure session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-md w-full space-y-8 bg-surface border border-outline-variant p-8 rounded-3xl shadow-xl shadow-surface-variant/20">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary font-bold text-xl shadow-md shadow-primary/20">
            TN
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">
            Welcome to TN PWA Book
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Access free school books, highlights, and offline study tracking
          </p>
        </div>

        {/* Message Indicator */}
        {message && (
          <div className={`p-4 rounded-2xl text-xs font-semibold border ${
            message.type === 'success' 
              ? 'bg-primary-container/10 border-primary/20 text-primary' 
              : 'bg-error-container/10 border-error/20 text-error'
          }`}>
            {message.text}
          </div>
        )}

        {/* Auth Forms */}
        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Mail size={18} />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border.5 border-outline rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-surface-variant/20 text-foreground transition-all"
                  placeholder="Enter email to get secure OTP"
                />
              </div>
            </div>

            <button
              id="send-otp-btn"
              type="submit"
              disabled={authLoading || !email}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-2xl text-on-primary bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Send OTP Code <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
            <div className="text-center">
              <span className="text-xs text-on-surface-variant">Sending to: <b>{email}</b></span>
              <button 
                type="button" 
                onClick={() => { setStep('email'); setMessage(null); }}
                className="block mx-auto text-xs text-primary font-bold hover:underline mt-1"
              >
                Change Email Address
              </button>
            </div>
            <div>
              <label htmlFor="otp-token" className="sr-only">Enter OTP</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <ShieldCheck size={18} />
                </div>
                <input
                  id="otp-token"
                  name="otp"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border.5 border-outline rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-surface-variant/20 text-foreground text-center tracking-widest font-mono transition-all"
                  placeholder="6-digit verification code"
                />
              </div>
            </div>

            <button
              id="verify-otp-btn"
              type="submit"
              disabled={authLoading || !otp}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-2xl text-on-primary bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Verify & Login'
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute w-full border-t border-outline-variant" />
          <span className="relative px-3 bg-surface text-xs text-on-surface-variant font-medium">Or continue with</span>
        </div>

        {/* Google OAuth Login Button */}
        <button
          id="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={authLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-outline-variant bg-surface hover:bg-surface-variant/30 text-sm font-semibold rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Google SVG Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01 0 12 0 7.37 0 3.4 2.67 1.5 6.57l3.78 2.93C6.18 6.54 8.87 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.75 2.91c2.19-2.02 3.7-5.01 3.7-8.63z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.93c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.5 7.42C.54 9.34 0 11.52 0 13.79s.54 4.45 1.5 6.37l3.78-2.93c-.24-.72-.38-1.49-.38-2.29z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.75-2.91c-1.1.74-2.51 1.18-4.21 1.18-3.13 0-5.82-2.15-6.77-5.05L1.45 17.2C3.4 21.09 7.37 24 12 24z"
            />
          </svg>
          Google Classroom
        </button>

      </div>
    </div>
  );
}
