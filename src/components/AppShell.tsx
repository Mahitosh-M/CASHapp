import { History, Home, LogOut, WalletCards, WifiOff } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SHOP_OPTIONS, getShopName } from '../utils/shops';

export const AppShell = () => {
  const { currentShopId, profile, logout, setAdminShop } = useAuth();
  const online = useOnlineStatus();

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="brand-mark"><WalletCards size={25} /></div>
            <div>
              <strong>Cash App</strong>
              <span>{currentShopId ? getShopName(currentShopId) : 'Branch cash'}</span>
            </div>
          </div>
          <button className="icon-button header-logout" type="button" onClick={() => void logout()} title="Logout" aria-label="Logout">
            <LogOut size={21} />
          </button>
        </div>
        {profile?.role === 'Admin' ? (
          <div className="admin-shop-control" role="group" aria-label="Select shop">
            {SHOP_OPTIONS.map((shop) => (
              <button
                key={shop.id}
                type="button"
                className={currentShopId === shop.id ? 'selected' : ''}
                aria-pressed={currentShopId === shop.id}
                onClick={() => setAdminShop(shop.id)}
              >
                {shop.name}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {!online ? (
        <div className="offline-banner" role="status"><WifiOff size={17} /> No internet. Financial actions are disabled.</div>
      ) : null}

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink to="/" end>
          <Home size={21} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/history">
          <History size={21} />
          <span>History</span>
        </NavLink>
      </nav>
    </div>
  );
};
