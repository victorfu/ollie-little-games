import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import Home from "@/pages/home";
import Monsters from "@/pages/monsters";
import Adventure from "@/pages/adventure";
import ForestJourney from "@/pages/forest";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/monsters", element: <Monsters /> },
  { path: "/adventure", element: <Adventure /> },
  { path: "/forest", element: <ForestJourney /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
