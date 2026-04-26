// Spot'd API client. Mirrors the Base44 SDK shape used by existing components,
// so we don't have to touch the React pages.
import axios from "axios";

const BASE = import.meta.env.VITE_BACKEND_URL || (typeof window !== "undefined" ? window.__SPOTD_BACKEND__ : "") || "";
const API_BASE = (import.meta.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" && window.localStorage.getItem("REACT_APP_BACKEND_URL")) || "") || "";

// REACT_APP_BACKEND_URL is the Emergent convention. Vite exposes import.meta.env vars,
// so we read it from .env via import.meta.env.REACT_APP_BACKEND_URL (Vite reads any prefix).
const BACKEND = import.meta.env.REACT_APP_BACKEND_URL || API_BASE || BASE || "";

const TOKEN_KEY = "spotd_token";

export const tokenStore = {
  get: () => (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null),
  set: (t) => typeof window !== "undefined" && window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => typeof window !== "undefined" && window.localStorage.removeItem(TOKEN_KEY),
};

const http = axios.create({ baseURL: BACKEND, timeout: 20000 });
http.interceptors.request.use((config) => {
  const tok = tokenStore.get();
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

// ---- Generic entity client mirroring base44.entities.<Name>.<method> ----
function makeEntity(name) {
  return {
    /** list(sort?, limit?) — Base44 SDK signature */
    list: async (sort, limit) => {
      const params = {};
      if (sort) params.sort = sort;
      if (limit) params.limit = limit;
      const { data } = await http.get(`/api/entities/${name}`, { params });
      return data;
    },
    /** filter(filters, sort?, limit?) */
    filter: async (filters, sort, limit) => {
      const params = {};
      if (filters && Object.keys(filters).length) params.filter = JSON.stringify(filters);
      if (sort) params.sort = sort;
      if (limit) params.limit = limit;
      const { data } = await http.get(`/api/entities/${name}`, { params });
      return data;
    },
    findOne: async (filters) => {
      const arr = await makeEntity(name).filter(filters, undefined, 1);
      return arr[0] || null;
    },
    get: async (id) => {
      const { data } = await http.get(`/api/entities/${name}/${id}`);
      return data;
    },
    create: async (payload) => {
      const { data } = await http.post(`/api/entities/${name}`, payload);
      return data;
    },
    update: async (id, payload) => {
      const { data } = await http.patch(`/api/entities/${name}/${id}`, payload);
      return data;
    },
    delete: async (id) => {
      const { data } = await http.delete(`/api/entities/${name}/${id}`);
      return data;
    },
  };
}

const ENTITY_NAMES = [
  "User", "Profile", "Subscription", "CastingCall", "CastingApplication",
  "Spot", "Endorsement", "SpotRequest", "SavedProfile", "ContactReveal",
  "RoleAlert", "Notification", "SpottedWith", "VerificationCode",
  "ProfileView", "PortfolioClick", "SearchAppearance", "CompanyProfile",
];

const entities = ENTITY_NAMES.reduce((acc, n) => {
  acc[n] = makeEntity(n);
  return acc;
}, {});

// ---- Auth ----
const auth = {
  isAuthenticated: async () => {
    if (!tokenStore.get()) return false;
    try {
      await http.get("/api/auth/me");
      return true;
    } catch {
      return false;
    }
  },
  me: async () => {
    const { data } = await http.get("/api/auth/me");
    return data;
  },
  requestCode: async (email) => {
    const { data } = await http.post("/api/auth/request-code", { email });
    return data;
  },
  verifyCode: async (email, code) => {
    const { data } = await http.post("/api/auth/verify-code", { email, code });
    if (data.token) tokenStore.set(data.token);
    return data;
  },
  logout: (returnUrl) => {
    tokenStore.clear();
    if (returnUrl) {
      window.location.href = "/login?next=" + encodeURIComponent(returnUrl);
    } else {
      window.location.href = "/";
    }
  },
  redirectToLogin: (returnUrl) => {
    const next = encodeURIComponent(returnUrl || window.location.href);
    window.location.href = `/login?next=${next}`;
  },
};

// ---- Functions ----
const functions = {
  invoke: async (name, payload = {}) => {
    const { data } = await http.post(`/api/functions/${name}`, payload);
    return data;
  },
};

// ---- Stripe helpers ----
const payments = {
  startCheckout: async (planId) => {
    const { data } = await http.post("/api/stripe/checkout", {
      plan_id: planId,
      origin_url: window.location.origin,
    });
    return data;
  },
  status: async (sessionId) => {
    const { data } = await http.get(`/api/stripe/status/${sessionId}`);
    return data;
  },
  founderCount: async () => {
    const { data } = await http.get("/api/stripe/founder-count");
    return data;
  },
  claimFounder: async () => {
    const { data } = await http.post("/api/stripe/founder-claim", {});
    return data;
  },
};

// ---- Integrations (Base44 SDK shim) ----
// Default upload type is "company-logo" which works for casting-call logos.
const integrations = {
  Core: {
    UploadFile: async ({ file, type = "company-logo" }) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await http.post(`/api/upload/${type}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return { file_url: data.file_url || data.url };
    },
  },
};

export const base44 = {
  entities,
  auth,
  functions,
  payments,
  integrations,
  http,
  baseURL: BACKEND,
};

export default base44;
