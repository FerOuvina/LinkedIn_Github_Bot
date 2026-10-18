import { Route } from "wouter";

import Home from "./components/Home.jsx";
import GettingStarted from "./components/GettingStarted.jsx";
import Guide from "./components/Guide.jsx";
import { SetupProvider } from "./context/SetupContext.jsx";

function App() {
  return (
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
  );
}

export default App;
