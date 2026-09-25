import { NLogin, useNostrLogin } from '@nostrify/react/login';
import { useEffect, useRef } from 'react';

type PeekProvider = { peekPublicKey?: () => Promise<string | undefined> };
const isPubkey = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

export function AutoLogin() {
  const { logins, addLogin, setLogin } = useNostrLogin();
  const pending = useRef(false);
  const hasLogin = useRef(logins.length > 0);
  hasLogin.current = logins.length > 0;

  useEffect(() => {
    if (logins.length > 0 || pending.current) return;
    const peekPublicKey = (window.nostr as PeekProvider | undefined)?.peekPublicKey;
    if (typeof peekPublicKey !== 'function') return;

    pending.current = true;
    void peekPublicKey.call(window.nostr)
      .then((pubkey) => {
        if (hasLogin.current || !isPubkey(pubkey)) return;
        const login = new NLogin('extension', pubkey, null).toJSON();
        addLogin(login);
        setLogin(login.id);
      })
      .catch(() => undefined)
      .finally(() => {
        pending.current = false;
      });
  }, [logins.length, addLogin, setLogin]);

  return null;
}
