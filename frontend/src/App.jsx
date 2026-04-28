import "./App.css";
import { useAuth } from "./AuthContext.jsx";
import LoginScreen from "./LoginScreen.jsx";
import AppRouter from "./AppRouter.jsx";

/**
 * App — auth gate only.
 *
 * Shows a loading spinner while the session is being verified,
 * the login screen if no user is authenticated,
 * or the full app router once signed in.
 */
export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return <AppRouter />;
}
