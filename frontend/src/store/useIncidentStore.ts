// =============================================================================
// useIncidentStore — single Zustand store holding:
//   1. Auth state (current user + tokens, persisted to localStorage)
//   2. The incidents collection (source of truth for every dashboard/table/map)
//   3. WebSocket wiring: connects once on login, updates state in real time
//      as `incidentUpdated`, `newIncident`, `incidentAssigned`, and `slaAlert`
//      events arrive from NotificationsGateway.
// =============================================================================
import { create } from 'zustand';
import { api, tokenStorage } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import type { Incident, SlaAlertPayload, User } from '../types';

const USER_STORAGE_KEY = 'safestreet_user';

interface IncidentStoreState {
  // --- auth ---
  currentUser: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;

  // --- incidents ---
  incidents: Incident[];
  incidentsLoading: boolean;
  slaAlerts: SlaAlertPayload[];

  // --- actions: auth ---
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  hydrateFromStorage: () => Promise<void>;

  // --- actions: incidents ---
  fetchIncidents: (params?: Record<string, string>) => Promise<void>;
  connectRealtime: () => void;
  upsertIncident: (incident: Incident) => void;
}

export const useIncidentStore = create<IncidentStoreState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  authLoading: true,
  incidents: [],
  incidentsLoading: false,
  slaAlerts: [],

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStorage.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    set({ currentUser: data.user, isAuthenticated: true });
    get().connectRealtime();
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    tokenStorage.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    set({ currentUser: data.user, isAuthenticated: true });
    get().connectRealtime();
  },

  logout: () => {
    disconnectSocket();
    tokenStorage.clear();
    localStorage.removeItem(USER_STORAGE_KEY);
    set({ currentUser: null, isAuthenticated: false, incidents: [], slaAlerts: [] });
  },

  // Called once on app boot: restores the persisted user object if an access
  // token is still present. Any subsequently-expired/invalid token is caught
  // by the axios response interceptor's refresh flow (or forces re-login if
  // the refresh token has also expired).
  hydrateFromStorage: async () => {
    const token = tokenStorage.getAccessToken();
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !storedUser) {
      set({ authLoading: false });
      return;
    }
    try {
      const user = JSON.parse(storedUser) as User;
      set({ currentUser: user, isAuthenticated: true, authLoading: false });
      get().connectRealtime();
    } catch {
      set({ authLoading: false });
    }
  },

  fetchIncidents: async (params) => {
    set({ incidentsLoading: true });
    try {
      const { data } = await api.get<Incident[]>('/incidents', { params });
      set({ incidents: data });
    } finally {
      set({ incidentsLoading: false });
    }
  },

  upsertIncident: (incident) => {
    set((state) => {
      const exists = state.incidents.some((i) => i.id === incident.id);
      return {
        incidents: exists
          ? state.incidents.map((i) => (i.id === incident.id ? incident : i))
          : [incident, ...state.incidents],
      };
    });
  },

  connectRealtime: () => {
    const socket = getSocket();

    // Guard against attaching duplicate listeners if connectRealtime is
    // called more than once for the same socket instance.
    socket.off('incidentUpdated');
    socket.off('newIncident');
    socket.off('incidentAssigned');
    socket.off('slaAlert');

    socket.on('incidentUpdated', (incident: Incident) => get().upsertIncident(incident));
    socket.on('newIncident', (incident: Incident) => get().upsertIncident(incident));
    socket.on('incidentAssigned', (incident: Incident) => get().upsertIncident(incident));
    socket.on('slaAlert', (alert: SlaAlertPayload) => {
      set((state) => ({ slaAlerts: [alert, ...state.slaAlerts].slice(0, 50) }));
    });
  },
}));
