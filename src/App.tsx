import { useMemo, useState } from "react";
import BunnyJumper from "./components/BunnyJumper";
import GameHub from "./components/GameHub";
import MeteorGlider from "./components/MeteorGlider";

type ActiveView = "hub" | "bunny" | "meteor";

function App() {
  const [activeView, setActiveView] = useState<ActiveView>("hub");

  const view = useMemo(() => {
    if (activeView === "bunny") {
      return (
        <BunnyJumper
          onExit={() => {
            setActiveView("hub");
          }}
        />
      );
    }

    if (activeView === "meteor") {
      return (
        <MeteorGlider
          onExit={() => setActiveView("hub")}
          onPlayBunny={() => setActiveView("bunny")}
        />
      );
    }

    return (
      <GameHub
        onPlayBunny={() => setActiveView("bunny")}
        onPlayMeteor={() => setActiveView("meteor")}
      />
    );
  }, [activeView]);

  return view;
}

export default App;
