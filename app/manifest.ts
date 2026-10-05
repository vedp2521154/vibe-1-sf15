import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Internal Mobility Desk",
    short_name: "Mobility Desk",
    description: "Coordinate shared campus mobility requests and rides.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#f7fbf8",
    theme_color: "#22a06b",
    icons: [
      { src: "/mobility-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/mobility-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/mobility-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
