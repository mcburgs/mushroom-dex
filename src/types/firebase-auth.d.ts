import 'firebase/auth';
import type { Persistence } from '@firebase/auth';

type ReactNativeAsyncStorage = {
  setItem(key: string, value: string): Promise<unknown>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<unknown>;
};

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
