import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serverar tillägget från https://rawburt1.github.io/dod-initiativ/
  base: command === "build" ? "/dod-initiativ/" : "/",
  server: {
    // Fast port så att SSH-tunneln och manifest-URL:en alltid stämmer
    port: 5173,
    strictPort: true,
    // Owlbear Rodeo måste kunna hämta manifest och sidor från dev-servern
    cors: { origin: "https://www.owlbear.rodeo" },
  },
}));
