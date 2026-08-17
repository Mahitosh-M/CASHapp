import { WalletCards } from 'lucide-react';

export const LoadingScreen = () => (
  <div className="loading-screen" role="status" aria-live="polite">
    <div className="brand-mark"><WalletCards size={30} /></div>
    <div className="loading-spinner" aria-hidden="true" />
    <span>Opening Cash App...</span>
  </div>
);
