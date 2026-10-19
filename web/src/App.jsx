import { lazy, Suspense } from "react";
import { Route, Router } from "wouter";

import Home from "./components/Home.jsx";
import GettingStarted from "./components/GettingStarted.jsx";
import StaticSetup from "./components/StaticSetup.jsx";
import { SetupProvider } from "./context/SetupContext.jsx";
import { ModeProvider, useMode } from "./context/ModeContext.jsx";

// The guide is the only page that renders markdown, and the markdown renderer
// plus the sanitiser are a large part of the bundle. Loading them on demand
// keeps them off the critical path for every other page.
const Guide = lazy(() => import("./components/Guide.jsx"));

// Pages serves the app under a subpath. Without this, the router compares
// "/LinkedIn_Github_Bot/" against the route "/" and matches nothing, which
// renders a blank page with no error in the console.
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** The wizard needs the local server; without it, show the steps as docs. */
function SetupRoute() {
  const mode = useMode();

  if (mode === "local") return <GettingStarted />;
  return <StaticSetup />;
}

function Loading() {
  return (
    <div className="grid-bg flex min-h-screen items-center justify-center bg-void">
      <p className="ff-kicker animate-blink">loading…</p>
    </div>
  );
}

function App() {
  return (
    <Router base={BASE}>
      <ModeProvider>
        <SetupProvider>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/getting-started">
            <SetupRoute />
          </Route>
          <Route path="/guide">
            <Suspense fallback={<Loading />}>
              <Guide />
            </Suspense>
          </Route>
        </SetupProvider>
      </ModeProvider>
    </Router>
  );
}

export default App;
