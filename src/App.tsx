import { useMemo, useState } from "react";
import BunnyJumper from "./components/BunnyJumper";
import GameHub from "./components/GameHub";
import MeteorGlider from "./components/MeteorGlider";
import MushroomAdventure from "./components/MushroomAdventure";

type ActiveView = "hub" | "bunny" | "meteor" | "mushroom";

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

    if (activeView === "mushroom") {
      return (
        <MushroomAdventure
          onExit={() => setActiveView("hub")}
        />
      );
    }

    return (
      <GameHub
        onPlayBunny={() => setActiveView("bunny")}
        onPlayMeteor={() => setActiveView("meteor")}
        onPlayMushroom={() => setActiveView("mushroom")}
      />
    );
  }, [activeView]);

  return view;
}

export default App;
