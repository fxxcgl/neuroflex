import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  clinicianId: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, patientId, clinicianId }) => {
  const [gateways, setGateways] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Fetch active gateways for this doctor
      supabase
        .from('doctor_payment_accounts')
        .select('gateway')
        .eq('doctor_id', clinicianId)
        .eq('status', 'active')
        .then(({ data, error }) => {
          if (!error && data) {
            setGateways(data.map(d => d.gateway));
          }
          setLoading(false);
        });
    }
  }, [isOpen, clinicianId]);

  if (!isOpen) return null;

  const handleSubscribe = async (gateway: string) => {
    setSubscribing(gateway);
    try {
      const res = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, doctorId: clinicianId, gateway, amount: 20000 }) // $200.00
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setSubscribing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Subscribe to Care</h2>
              <p className="text-xs text-indigo-300 font-medium">Continue your tele-rehabilitation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-900">$200.00 / month</h3>
            <p className="text-sm text-slate-500">Includes weekly reviews, custom prescriptions, and 24/7 telemetry sync with your physical therapist.</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Select Payment Method</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-8 text-indigo-600">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : gateways.length === 0 ? (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-900 text-sm font-semibold text-center">
                Your doctor has not connected any payment gateways yet. Please contact them directly.
              </div>
            ) : (
              <>
                {gateways.includes('stripe') && (
                  <button 
                    onClick={() => handleSubscribe('stripe')}
                    disabled={!!subscribing}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">S</div>
                      <div className="text-left">
                        <div className="font-bold text-slate-900">Pay with Card (Stripe)</div>
                        <div className="text-xs text-slate-500">Secure credit/debit checkout</div>
                      </div>
                    </div>
                    {subscribing === 'stripe' ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />}
                  </button>
                )}

                {gateways.includes('razorpay') && (
                  <button 
                    onClick={() => handleSubscribe('razorpay')}
                    disabled={!!subscribing}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-600 hover:bg-blue-50 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center">R</div>
                      <div className="text-left">
                        <div className="font-bold text-slate-900">Pay with Razorpay</div>
                        <div className="text-xs text-slate-500">UPI, Cards, Netbanking</div>
                      </div>
                    </div>
                    {subscribing === 'razorpay' ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />}
                  </button>
                )}

                {gateways.includes('paypal') && (
                  <button 
                    onClick={() => handleSubscribe('paypal')}
                    disabled={!!subscribing}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-sky-600 hover:bg-sky-50 flex items-center justify-between transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 font-black flex items-center justify-center">P</div>
                      <div className="text-left">
                        <div className="font-bold text-slate-900">Pay with PayPal</div>
                        <div className="text-xs text-slate-500">International checkout</div>
                      </div>
                    </div>
                    {subscribing === 'paypal' ? <Loader2 className="w-5 h-5 animate-spin text-sky-600" /> : <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-sky-600 transition-colors" />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
