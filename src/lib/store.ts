import { useSyncExternalStore } from 'react';

export type Fixture = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string; // 'yesterday', 'today', 'tomorrow'
  time: string;
};

export type MatchResult = 'pending' | 'won' | 'lost';

export type Prediction = {
  fixtureId: string;
  tip: string; // e.g. "1", "X", "2", "O2.5"
  result: MatchResult;
};

export type VipPackage = {
  id: 'vip1' | 'vip2' | 'vip3';
  name: string;
  price: number;
  status: 'available' | 'sold_out';
  bookingCode: string;
  combinedOdds: number;
  predictions: Prediction[];
};

export type FreePrediction = Prediction & { id: string };

export type UserTicket = {
  id: string;
  packageId: 'vip1' | 'vip2' | 'vip3';
  purchasedAt: string;
};

type AppState = {
  fixtures: Fixture[];
  vipPackages: Record<string, VipPackage>;
  freePredictions: FreePrediction[];
  userTickets: UserTicket[];
};

// Empty store — all data now comes from Supabase
const defaultState: AppState = {
  fixtures: [],
  vipPackages: {},
  freePredictions: [],
  userTickets: []
};

// Simple pub-sub store
class Store {
  private state: AppState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = defaultState;
  }

  getState = () => this.state;

  setState = (newState: Partial<AppState>) => {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach(listener => listener());
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

const store = new Store();

export const useStore = () => {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
};

// Actions
export const updateVipPackage = (id: string, data: Partial<VipPackage>) => {
  const state = store.getState();
  const pkg = state.vipPackages[id];
  if (pkg) {
    store.setState({
      vipPackages: {
        ...state.vipPackages,
        [id]: { ...pkg, ...data }
      }
    });
  }
};

export const buyTicket = (packageId: 'vip1' | 'vip2' | 'vip3') => {
  const state = store.getState();
  const newTicket: UserTicket = {
    id: `ticket_${Date.now()}`,
    packageId,
    purchasedAt: new Date().toISOString()
  };
  store.setState({
    userTickets: [...state.userTickets, newTicket]
  });
};

export const updateFreePredictions = (predictions: FreePrediction[]) => {
  store.setState({ freePredictions: predictions });
};
