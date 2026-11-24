import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const pub = path.resolve(import.meta.dirname, "../public");
const manifest = JSON.parse(readFileSync(path.join(pub, "manifest.webmanifest"), "utf8")) as {
  name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
  shortcuts: { url: string }[];
};

/** Width and height of a PNG, read from its header. */
function pngSize(file: string) {
  const b = readFileSync(file);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

describe("web app manifest", () => {
  it("is installable: a name, a standalone display and relative start and scope", () => {
    expect(manifest.name).toBe("Launchpad");
    expect(manifest.display).toBe("standalone");
    // Relative, so the app works from any folder of a static host.
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
  });

  it("has every icon file, at the size it claims", () => {
    for (const icon of manifest.icons.filter((i) => i.type === "image/png")) {
      const file = path.join(pub, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file), icon.src).toBe(icon.sizes);
    }
  });

  it("has a 192, a 512 and a maskable icon, which browsers require for install", () => {
    const sizes = manifest.icons.map((i) => `${i.sizes}:${i.purpose ?? "any"}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes).toContain("512x512:maskable");
  });

  it("is linked from the page, with an iOS touch icon", () => {
    const html = readFileSync(path.resolve(import.meta.dirname, "../index.html"), "utf8");
    expect(html).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(pngSize(path.join(pub, "icons/apple-touch-icon.png"))).toBe("180x180");
  });

  it("opens shortcuts on hash routes", () => {
    for (const s of manifest.shortcuts) expect(s.url).toMatch(/^\.\/#\//);
  });
});
