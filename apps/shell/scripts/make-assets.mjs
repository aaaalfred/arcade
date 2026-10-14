// Genera los PNG de origen para @capacitor/assets desde resources/*.svg
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "resources");
await sharp(join(dir, "icon.svg")).resize(1024, 1024).png().toFile(join(dir, "icon-only.png"));
await sharp(join(dir, "icon.svg")).resize(1024, 1024).png().toFile(join(dir, "icon-foreground.png"));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#14161d" } }).png().toFile(join(dir, "icon-background.png"));
await sharp(join(dir, "splash.svg")).resize(2732, 2732).png().toFile(join(dir, "splash.png"));
await sharp(join(dir, "splash.svg")).resize(2732, 2732).negate({ alpha: false }).png().toFile(join(dir, "splash-dark.png"));
console.log("PNG generados en resources/");
