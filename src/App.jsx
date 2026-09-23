import { lazy, Suspense } from "react";
import { useAuth } from "./hooks/useAuth.js";

const PortTwin = lazy(() => import("./PortTwin.jsx"));

export default function App() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return <SignInScreen auth={auth} />;
  return (
    <Suspense fallback={<SignInScreen auth={{ status: "loading-app" }} />}>
      <PortTwin username={auth.username} onSignOut={auth.signOut} />
    </Suspense>
  );
}

function SignInScreen({ auth }) {
  const busy = auth.status === "checking" || auth.status === "loading-app";
  return (
    <main className="sign-in">
      <div className="sign-in__card">
        <h1>Port of Cork · Operations Twin</h1>
        <p>
          A live 3D digital twin of Cork Harbour: AIS traffic, the shipping schedule, berth occupancy,
          marine conditions and 3D analysis tools.
        </p>
        {auth.status === "error" ? (
          <calcite-notice open kind="danger" icon="exclamation-mark-triangle">
            <div slot="message">{auth.error}</div>
          </calcite-notice>
        ) : (
          <calcite-button
            width="full"
            icon-start="user"
            loading={busy}
            disabled={busy}
            onClick={auth.signIn}
          >
            {auth.status === "checking"
              ? "Checking sign-in…"
              : auth.status === "loading-app"
                ? "Loading the twin…"
                : "Sign in with ArcGIS Online"}
          </calcite-button>
        )}
      </div>
    </main>
  );
}
