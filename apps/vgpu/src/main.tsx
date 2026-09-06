import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Example from "./example/index";
import "./style.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <Example />
  </StrictMode>,
);
