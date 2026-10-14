import { SimulatedAdOverlay } from "./components/SimulatedAdOverlay";
import { Tabs } from "./components/Tabs";
import { Toasts } from "./components/Toast";
import { route } from "./router";
import { Home } from "./screens/Home";
import { Play } from "./screens/Play";
import { Profile } from "./screens/Profile";
import { Ranking } from "./screens/Ranking";

export function App() {
  const r = route.value;
  return (
    <div class="shell">
      {r.name === "home" && <Home />}
      {r.name === "ranking" && <Ranking gameId={r.id} />}
      {r.name === "profile" && <Profile />}
      {r.name === "play" && <Play key={r.id} id={r.id} />}
      {r.name !== "play" && <Tabs />}
      <SimulatedAdOverlay />
      <Toasts />
    </div>
  );
}
