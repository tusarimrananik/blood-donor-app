import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const imagesDir = path.join(root, "assets", "images");

async function read(name) {
  return fs.readFile(path.join(imagesDir, name));
}

async function writePng(svgName, outName, size) {
  const svg = await read(svgName);
  await sharp(svg).resize(size, size).png().toFile(path.join(imagesDir, outName));
}

async function writeSolidBackground(outName, size, color) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toFile(path.join(imagesDir, outName));
}

async function main() {
  await writePng("app-icon.svg", "icon.png", 1024);
  await writePng("app-icon.svg", "splash-icon.png", 1024);
  await writePng("app-icon.svg", "favicon.png", 48);
  await writePng("app-icon-foreground.svg", "android-icon-foreground.png", 1024);
  await writePng("app-icon-monochrome.svg", "android-icon-monochrome.png", 1024);
  await writeSolidBackground("android-icon-background.png", 1024, "#F6DDE4");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
