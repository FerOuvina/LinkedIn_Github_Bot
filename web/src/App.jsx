import { Route, Router } from "wouter";

import Home from "./components/Home.jsx";
import GettingStarted from "./components/GettingStarted.jsx";
import Guide from "./components/Guide.jsx";
import { SetupProvider } from "./context/SetupContext.jsx";

// Pages serves the app under a subpath. Without this, the router compares
// "/LinkedIn_Github_Bot/" against the route "/" and matches nothing, which
// renders a blank page with no error in the console.
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function App() {
  return (
    <Router base={BASE}>
      <SetupProvider>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/getting-started">
          <GettingStarted />
        </Route>
        <Route path="/guide">
          <Guide />
        </Route>
      </SetupProvider>
    </Router>
  );
}

export default App;
