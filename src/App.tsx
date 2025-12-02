import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import BunnyJumper from "./components/BunnyJumper";
import GameHub from "./components/GameHub";
import MeteorGlider from "./components/MeteorGlider";
import MushroomAdventure from "./components/MushroomAdventure";

function App() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <GameHub
            onPlayBunny={() => navigate("/bunny")}
            onPlayMeteor={() => navigate("/meteor")}
            onPlayMushroom={() => navigate("/mushroom")}
          />
        }
      />
      <Route
        path="/bunny"
        element={<BunnyJumper onExit={() => navigate("/")} />}
      />
      <Route
        path="/meteor"
        element={<MeteorGlider onExit={() => navigate("/")} />}
      />
      <Route
        path="/mushroom"
        element={<MushroomAdventure onExit={() => navigate("/")} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
