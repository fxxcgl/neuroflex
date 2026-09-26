import React, { useState } from 'react';
import { Wallet, X, ChevronRight, CheckCircle2, IndianRupee, Clock } from 'lucide-react';
import { SESSION_FEE_DISPLAY } from '../../lib/wagmiConfig';

export type PaymentMethod = 'web3' | 'upi';

interface PaymentMethodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
  onPayLater?: () => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  onPayLater,
}) => {
  const [selected, setSelected] = useState<PaymentMethod | null>(null);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Session Complete</h2>
            <p className="text-sm text-teal-200 font-medium mt-1">Choose how you want to pay for analysis</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Web3 Option */}
          <div 
            onClick={() => setSelected('web3')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selected === 'web3' ? 'border-teal-500 bg-teal-50 shadow-md ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${selected === 'web3' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Wallet className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Web3 Wallet (x402)</h3>
                  <span className="font-black text-slate-900">{SESSION_FEE_DISPLAY}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Silent background payment on Base. Best for low fees.</p>
              </div>
              {selected === 'web3' && <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0 self-center" />}
            </div>
          </div>

          {/* UPI Option */}
          <div 
            onClick={() => setSelected('upi')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              selected === 'upi' ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${selected === 'upi' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <IndianRupee className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">UPI / Cards</h3>
                  <span className="font-black text-slate-900">₹160</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Pay easily using GPay, PhonePe, Paytm or Cards.</p>
              </div>
              {selected === 'upi' && <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 self-center" />}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-0 space-y-3">
          <button
            onClick={handleContinue}
            disabled={!selected}
            className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${
              selected 
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-0.5' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue to Payment <ChevronRight className="w-5 h-5 stroke-[3]" />
          </button>

          {/* Pay Later Option */}
          {onPayLater && (
            <button
              onClick={onPayLater}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-sm flex items-center justify-center gap-2 transition-all hover:border-amber-400 group"
            >
              <Clock className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              Pay Later — Skip & Check Dashboard
            </button>
          )}

          {onPayLater && (
            <p className="text-center text-xs text-slate-400 font-medium">
              Your session reps are saved. AI analysis unlocks after payment.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
