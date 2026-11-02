import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Profile = { phone: string; name: string; language: string; location: string };

const KEY = 'agribot.profile';

type SessionValue = {
  ready: boolean;
  profile: Profile | null;
  save: (p: Profile) => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/** Latest profile for non-React code (the API client). */
let current: Profile | null = null;
export const getProfile = () => current;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        current = raw ? (JSON.parse(raw) as Profile) : null;
        setProfile(current);
      })
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (p: Profile) => {
    current = p;
    setProfile(p);
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  }, []);

  const setLanguage = useCallback(
    async (language: string) => {
      if (current) await save({ ...current, language });
    },
    [save],
  );

  const logout = useCallback(async () => {
    current = null;
    setProfile(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  return (
    <SessionContext.Provider value={{ ready, profile, save, setLanguage, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
