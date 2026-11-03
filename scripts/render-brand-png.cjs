// Render the brand SVGs to transparent PNGs, app icons and favicon.ico.
//
// Usage: node scripts/render-brand-png.cjs
// Needs: puppeteer-core (npm i puppeteer-core) and a local Chrome or Edge.
//        Set BROWSER_PATH if the browser is not in a default location.
//        Python with Pillow is used to pack favicon.ico.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const puppeteer = require("puppeteer-core");

const root = path.resolve(__dirname, "..");
const brand = path.join(root, "assets/images/brand");
const browserPath =
  process.env.BROWSER_PATH ||
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find((p) => fs.existsSync(p));

// [source svg, output png, output width, output height]
const jobs = [
  ["stc-logo-horizontal.svg", "stc-logo-horizontal.png", 748, 128],
  ["stc-logo-horizontal.svg", "stc-logo-horizontal@3x.png", 1122, 192],
  ["stc-logo-horizontal-light.svg", "stc-logo-horizontal-light.png", 748, 128],
  ["stc-logo-horizontal-light.svg", "stc-logo-horizontal-light@3x.png", 1122, 192],
  ["stc-symbol.svg", "stc-symbol-512.png", 512, 512],
  ["stc-symbol-light.svg", "stc-symbol-light-512.png", 512, 512],
  ["stc-app-icon.svg", "../../../apple-touch-icon.png", 180, 180],
  ["stc-app-icon.svg", "../../../icon-192.png", 192, 192],
  ["stc-app-icon.svg", "../../../icon-512.png", 512, 512],
  ["stc-app-icon-maskable.svg", "../../../icon-maskable-512.png", 512, 512],
  ["stc-app-icon.svg", "favicon-16.png", 16, 16],
  ["stc-app-icon.svg", "favicon-32.png", 32, 32],
  ["stc-app-icon.svg", "favicon-48.png", 48, 48],
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
  const page = await browser.newPage();
  for (const [src, out, w, h] of jobs) {
    const svg = fs.readFileSync(path.join(brand, src), "utf8");
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`
    );
    await page.screenshot({ path: path.join(brand, out), omitBackground: true });
  }
  await browser.close();

  const ico = path.join(root, "favicon.ico");
  execFileSync("python", [
    "-c",
    "import sys;from PIL import Image;ims=[Image.open(p).convert('RGBA') for p in sys.argv[2:]];" +
      "ims[-1].save(sys.argv[1],format='ICO',sizes=[i.size for i in ims],append_images=ims[:-1])",
    ico,
    ...["favicon-16.png", "favicon-32.png", "favicon-48.png"].map((f) => path.join(brand, f)),
  ]);
  for (const f of ["favicon-16.png", "favicon-32.png", "favicon-48.png"]) {
    fs.unlinkSync(path.join(brand, f));
  }
  console.log("Brand PNGs and favicon.ico written.");
})();
