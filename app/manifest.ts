import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Winter Tour 26/27",
    short_name: "Winter Tour",
    description: "Turneringsoversikt, scorekort og Order of Merit for Winter Tour 26/27.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f5",
    theme_color: "#f3f4f5",
    icons: [
      {
        src: "/icons/logo-ny-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/logo-ny-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/logo-ny-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
