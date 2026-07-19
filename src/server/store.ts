import type {DataStore} from './types';
import {MemoryStore} from './memory-store';
import {SupabaseStore} from './supabase-store';

let singleton: DataStore | null = null;
let testStore: DataStore | null = null;
const shared = globalThis as typeof globalThis & {__lineOdorE2EStore?: DataStore};

export function setStoreForTests(store: DataStore | null) {
  if (process.env.NODE_ENV !== 'test') throw new Error('TEST_STORE_OUTSIDE_TEST');
  testStore = store;
}

export function getStore(): DataStore {
  if (testStore) return testStore;
  if (process.env.E2E_TEST_MODE === '1' && process.env.APP_DATA_STORE === 'memory') {
    shared.__lineOdorE2EStore ??= new MemoryStore();
    return shared.__lineOdorE2EStore;
  }
  if (!singleton) {
    singleton = new SupabaseStore();
  }
  return singleton;
}
