/**
 * @fileoverview Chrome Extension Side Panel — Entry Point
 *
 * TanStack Start SSR'dan bağımsız React entry point.
 * Doğrudan SidePanel componentini render eder.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import "../src/styles.css"; // Tailwind CSS + tema değişkenleri
import { SidePanel } from "../src/components/layout/SidePanel.jsx";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(React.createElement(SidePanel));
