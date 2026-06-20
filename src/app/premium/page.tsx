'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { 
  Crown, 
  Check, 
  CreditCard, 
  Smartphone, 
  Loader2, 
  Sparkles,
  ShieldCheck,
  Award
} from 'lucide-react';

export default function PremiumPage() {
  const { user, profile, isPremium, refreshProfile, loading } = useAuth();
  const router = useRouter();

  const [checkoutStep, setCheckoutStep] = useState<'details' | 'simulating' | 'success'>('details');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  // Guard
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const price = billingCycle === 'yearly' ? '₹499/year' : '₹49/month';
  const cycleLabel = billingCycle === 'yearly' ? 'billed annually (save 15%)' : 'billed monthly';

  const handleSimulatePayment = async () => {
    if (!user) return;
    setCheckoutStep('simulating');

    try {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const endDate = new Date();
      if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // Upsert user subscription in Supabase database
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          status: 'active',
          plan_type: 'premium',
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error inserting subscription:', error);
        alert('Failed to register subscription. Please try again.');
        setCheckoutStep('details');
      } else {
        await refreshProfile();
        setCheckoutStep('success');
      }
    } catch (err) {
      console.error('Simulated billing exception:', err);
      alert('Billing simulation encountered an error.');
      setCheckoutStep('details');
    }
  };

  const premiumFeatures = [
    { title: 'Class 10-12 Access', desc: 'Unlock senior level books required for board examinations.' },
    { title: 'Unlimited Highlights', desc: 'Sync color-coded selections to your notebooks dynamically.' },
    { title: 'Offline PDF Downloads', desc: 'Save books to local device memory to study during commutes without internet.' },
    { title: 'Smart Search in PDFs', desc: 'Quickly find keywords and reference terms across multiple textbooks.' },
    { title: 'Real-time Progress Tracker', desc: 'Seamlessly pick up reading exactly where you left off across phone, tablet, and desktop.' },
  ];

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="text-center max-w-lg mx-auto space-y-2">
        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-3 py-1 rounded-full text-xs border border-amber-500/15">
          <Crown size={12} /> Membership Hub
        </span>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Tamilnadu School Book Premium</h1>
        <p className="text-sm text-on-surface-variant font-medium">Unlock elite educational tools and full standard syllabuses offline</p>
      </div>

      {isPremium ? (
        /* ALREADY PREMIUM VIEW */
        <div className="bg-surface border border-amber-500/30 p-8 rounded-3xl text-center space-y-4 max-w-md mx-auto shadow-md">
          <div className="w-16 h-16 bg-amber-500/15 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Award size={36} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">You are a Premium Student!</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              All books, infinite highlights, search functions, and offline caches are fully available. Thank you for supporting the TN PWA Book community.
            </p>
          </div>
          <button 
            onClick={() => router.push('/library')}
            className="w-full py-2.5 bg-primary text-on-primary font-bold text-xs rounded-2xl shadow-md transition-all hover:scale-[1.02]"
          >
            Go to Library
          </button>
        </div>
      ) : (
        /* PREMIUM SALES PITCH VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          {/* Features pitch */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Why Upgrade to Premium?</h2>
            
            <div className="space-y-4">
              {premiumFeatures.map((feat, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={12} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-foreground">{feat.title}</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Card */}
          <div className="bg-surface border border-outline-variant p-6 rounded-3xl shadow-sm space-y-6 text-center">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Crown size={28} className="animate-pulse" />
            </div>
            
            {/* Billing Toggle */}
            <div className="bg-surface-variant/40 border border-outline-variant/60 p-1 rounded-2xl flex max-w-[240px] mx-auto">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition-all ${billingCycle === 'monthly' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingCycle('yearly')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-xl transition-all ${billingCycle === 'yearly' ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}
              >
                Yearly (Save 15%)
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-3xl font-black text-foreground">{price}</span>
              <span className="text-[11px] text-on-surface-variant block font-semibold">{cycleLabel}</span>
            </div>

            <button 
              id="unlock-premium-btn"
              onClick={() => {
                setCheckoutStep('details');
                setShowCheckoutModal(true);
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-[0.98] transition-all"
            >
              Get Premium Access
            </button>

            <span className="text-[10px] text-on-surface-variant font-medium block">
              Cancel anytime. No lock-in contracts. Full academic support.
            </span>
          </div>

        </div>
      )}

      {/* CHECKOUT MODAL OVERLAY */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-outline max-w-sm w-full p-6 rounded-3xl shadow-xl space-y-6">
            
            {checkoutStep === 'details' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-outline-variant/60">
                  <h3 className="font-extrabold text-foreground text-md flex items-center gap-1.5">
                    <CreditCard size={18} className="text-primary" /> Billing Simulator
                  </h3>
                  <span className="text-xs font-bold text-primary">{price}</span>
                </div>

                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  This simulates standard payment processing. No actual money will be charged. Clicking submit directly upgrades your Supabase record.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Cardholder Name</label>
                    <input 
                      type="text" 
                      defaultValue={profile?.full_name || 'Tamilnadu Student'}
                      disabled
                      className="block w-full px-3.5 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/20 text-on-surface-variant"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-on-surface-variant block mb-1">Card Number</label>
                    <input 
                      type="text" 
                      placeholder="4000 1234 5678 9010" 
                      disabled
                      className="block w-full px-3.5 py-2 border border-outline-variant rounded-xl text-xs bg-surface-variant/20 text-on-surface-variant tracking-wider"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowCheckoutModal(false)}
                    className="flex-1 py-2 text-xs font-semibold rounded-2xl border border-outline-variant hover:bg-surface-variant/35 text-foreground transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    id="submit-payment-btn"
                    onClick={handleSimulatePayment}
                    className="flex-1 py-2 text-xs font-bold rounded-2xl bg-primary hover:bg-primary/95 text-on-primary transition-all shadow-md"
                  >
                    Simulate Payment
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === 'simulating' && (
              <div className="py-8 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-extrabold text-foreground text-md">Verifying details...</h3>
                  <p className="text-[11px] text-on-surface-variant font-medium">Interfacing secure gateway simulation...</p>
                </div>
              </div>
            )}

            {checkoutStep === 'success' && (
              <div className="py-4 text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-foreground text-md flex items-center justify-center gap-1">
                    Payment Successful <Sparkles size={16} className="text-amber-500" />
                  </h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Congratulations! Your account is upgraded. Class 10, 11, 12 book modules are now unlocked.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowCheckoutModal(false);
                    router.push('/library');
                  }}
                  className="w-full py-2.5 bg-primary text-on-primary font-bold text-xs rounded-2xl shadow-md transition-all"
                >
                  Start Reading
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
