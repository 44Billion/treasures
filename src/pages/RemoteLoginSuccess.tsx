import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNostrLogin } from '@nostrify/react/login';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

// Storage key must match the one in AppProvider.tsx NostrLoginProvider
const LOGINS_STORAGE_KEY = 'nostr:login';

export function RemoteLoginSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logins } = useNostrLogin();
  const [checkCount, setCheckCount] = useState(0);
  const [status, setStatus] = useState<'checking' | 'success' | 'timeout'>('checking');

  // Check localStorage directly as a fallback
  const checkLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOGINS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, []);

  // Check if logged in via React state or localStorage
  const isLoggedIn = logins.length > 0 || checkLocalStorage();

  useEffect(() => {
    if (isLoggedIn) {
      setStatus('success');
      const timer = setTimeout(() => {
        // Try to close this tab (works if opened by signer app)
        // This leaves the user on the original tab which should detect the login
        window.close();
        // If we're still here (close didn't work), do a full page redirect
        window.location.href = '/';
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Check up to 20 times (10 seconds total) for the session to become active
    if (checkCount < 20) {
      const timer = setTimeout(() => {
        setCheckCount(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setStatus('timeout');
    }
    return undefined;
  }, [isLoggedIn, checkCount, navigate, checkLocalStorage]);

  // Listen for storage events (in case login is added from another context)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOGINS_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStatus('success');
            setTimeout(() => {
              window.close();
              window.location.href = '/';
            }, 1500);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === 'checking' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('remoteLogin.completing')}</h1>
            <p className="text-muted-foreground">{t('remoteLogin.verifying')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('remoteLogin.success')}</h1>
            <p className="text-muted-foreground">{t('remoteLogin.redirecting')}</p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('remoteLogin.timeout')}</h1>
            <p className="text-muted-foreground mb-4">
              {t('remoteLogin.timeoutDescription')}
            </p>
            <a
              href="/"
              className="text-primary hover:underline"
            >
              {t('remoteLogin.returnHome')}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
