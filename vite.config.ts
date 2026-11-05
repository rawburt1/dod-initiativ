import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Där GitHub Pages serverar tillägget */
const SITE_URL = "https://rawburt1.github.io/dod-initiativ/";

/**
 * Skriver om sökvägarna i dist/manifest.json till fullständiga URL:er vid bygge.
 * Owlbear Rodeo löser inte relativa sökvägar mot manifestets mapp, så på GitHub Pages
 * (som serverar från en undermapp) skulle t.ex. "index.html" pekas mot domänens rot.
 */
function absoluteManifestUrls(): Plugin {
  let outDir = "dist";
  return {
    name: "absolute-manifest-urls",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, "manifest.json");
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      const absolute = (path: string) => new URL(path.replace(/^\//, ""), SITE_URL).href;
      manifest.icon = absolute(manifest.icon);
      if (manifest.action) {
        manifest.action.icon = absolute(manifest.action.icon);
        manifest.action.popover = absolute(manifest.action.popover);
      }
      writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
    },
  };
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serverar tillägget från en undermapp, dev-servern från roten
  base: command === "build" ? new URL(SITE_URL).pathname : "/",
  plugins: [absoluteManifestUrls()],
  server: {
    // Fast port så att SSH-tunneln och manifest-URL:en alltid stämmer
    port: 5173,
    strictPort: true,
    // Owlbear Rodeo måste kunna hämta manifest och sidor från dev-servern
    cors: { origin: "https://www.owlbear.rodeo" },
  },
}));
