import { createFileRoute } from "@tanstack/react-router";
import { SidePanel } from "../components/layout/SidePanel.jsx";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Senara — Sesli Alışveriş Asistanı" },
      {
        name: "description",
        content:
          "Görme engelliler için sesli e-ticaret asistanı. Konuşun, Senara ürünü bulsun, analiz etsin, sipariş versin.",
      },
    ],
  }),
});

function Index() {
  return <SidePanel />;
}
