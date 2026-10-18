import { Route, Router } from "wouter";

import Home from "./components/Home.jsx";
import GettingStarted from "./components/GettingStarted.jsx";
import StaticSetup from "./components/StaticSetup.jsx";
import Guide from "./components/Guide.jsx";
import { SetupProvider } from "./context/SetupContext.jsx";
import { ModeProvider, useMode } from "./context/ModeContext.jsx";

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
            <Guide />
          </Route>
        </SetupProvider>
      </ModeProvider>
    </Router>
  );
}

export default App;
