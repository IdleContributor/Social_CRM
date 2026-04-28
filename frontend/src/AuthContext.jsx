import { createContext, useContext, useState, useEffect } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem("app_token") || null);
  const [loading, setLoading] = useState(true);

  // On mount, verify the stored token is still valid
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    // Set header before making the request
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    api.get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem("app_token");
        setToken(null);
        delete api.defaults.headers.common["Authorization"];
      })
      .finally(() => setLoading(false));
  }, []);

  // Called after Google sign-in succeeds
  const signIn = (newToken, newUser) => {
    localStorage.setItem("app_token", newToken);
    setToken(newToken);
    setUser(newUser);
    // Inject token into all future api requests
    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  const signOut = () => {
    localStorage.removeItem("app_token");
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  };

  // Inject token on every mount (handles page refresh)
  useEffect(() => {
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
