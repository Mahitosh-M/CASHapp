import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  getFriendlyLoginError,
  listenToAuthState,
  loadCashAppProfile,
  loginWithEmail,
  logoutUser
} from '../services/authService';
import type { ShopId, StaffProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: StaffProfile | null;
  currentShopId: ShopId | undefined;
  loading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAdminShop: (shopId: ShopId) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [adminShopId, setAdminShopId] = useState<ShopId>('SHOP_A');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const requestId = useRef(0);

  useEffect(() => listenToAuthState(async (currentUser) => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setFirebaseUser(currentUser);

    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const nextProfile = await loadCashAppProfile(currentUser);
      if (activeRequest !== requestId.current) return;
      setProfile(nextProfile);
      setAuthError('');
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      setFirebaseUser(null);
      setProfile(null);
      setAuthError(getFriendlyLoginError(error));
      await logoutUser();
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }), []);

  const login = async (email: string, password: string) => {
    setAuthError('');
    try {
      await loginWithEmail(email, password);
    } catch (error) {
      const message = getFriendlyLoginError(error);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    ++requestId.current;
    setFirebaseUser(null);
    setProfile(null);
    setAdminShopId('SHOP_A');
    setAuthError('');
    await logoutUser();
  };

  const currentShopId = profile?.role === 'Staff' ? profile.shopId : profile?.role === 'Admin' ? adminShopId : undefined;
  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    profile,
    currentShopId,
    loading,
    authError,
    login,
    logout,
    setAdminShop: (shopId) => {
      if (profile?.role === 'Admin') setAdminShopId(shopId);
    }
  }), [authError, currentShopId, firebaseUser, loading, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
