import React from 'react';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border-[4px] border-black p-6 md:p-8 transform transition-all scale-100 z-10">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 border-2 border-black mb-6 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <span className="text-3xl text-green-600 font-bold">$</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Support the Dev</h3>
            
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-yellow-800 font-medium">
                    This is a personal project! 🎨
                </p>
            </div>

            <p className="text-gray-600 mb-6 leading-relaxed">
                I built this app for you to have fun exploring new styles. However, the AI magic behind these outfit generations costs me money every time you click "Dress Me".
            </p>
            
            <p className="text-gray-600 mb-8 font-medium">
                If you enjoy using Cyber Closet, please consider donating to keep it free and running!
            </p>

            <div className="space-y-3">
                <button className="w-full py-3 px-4 bg-[#008CFF] hover:bg-[#0074D4] text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all flex items-center justify-center gap-2">
                    <span>Donate via Venmo</span>
                </button>
                <button className="w-full py-3 px-4 bg-[#003087] hover:bg-[#001C64] text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all flex items-center justify-center gap-2">
                    <span>Donate via PayPal</span>
                </button>
                <button className="w-full py-3 px-4 bg-[#635BFF] hover:bg-[#4B44C9] text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all flex items-center justify-center gap-2">
                    <span>Donate via Stripe</span>
                </button>
            </div>
            
            <p className="mt-6 text-xs text-gray-400">
                Thank you for your support! ❤️
            </p>
        </div>
      </div>
    </div>
  );
};