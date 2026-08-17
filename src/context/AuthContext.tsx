import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import {
  getFriendlyLoginError,
  listenToAuthState,
  loadCashAppProfile,
  loginWithEmail,
  logoutUser
} from '../services/authService';
import type { CashAppRole, ShopId, StaffProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: StaffProfile | null;
  currentShopId: ShopId | undefined;
  loading: boolean;
  authError: string;
  login: (email: string, password: string, expectedRole: CashAppRole) => Promise<void>;
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
  const expectedLoginRole = useRef<CashAppRole | null>(null);

  useEffect(() => listenToAuthState(async (currentUser) => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setFirebaseUser(currentUser);

    if (!currentUser) {
      expectedLoginRole.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const nextProfile = await loadCashAppProfile(currentUser);
      const expectedRole = expectedLoginRole.current;
      expectedLoginRole.current = null;
      if (expectedRole && nextProfile.role !== expectedRole) {
        throw new Error(`This account is registered as ${nextProfile.role}. Use ${nextProfile.role} login.`);
      }
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

  const login = async (email: string, password: string, expectedRole: CashAppRole) => {
    setAuthError('');
    expectedLoginRole.current = expectedRole;
    try {
      await loginWithEmail(email, password);
    } catch (error) {
      expectedLoginRole.current = null;
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
    expectedLoginRole.current = null;
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
