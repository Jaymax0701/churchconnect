
import sharp from "sharp";
import { resolve } from "node:path";

const publicDir = resolve("public");

const icons = [
    {
        input: "pwa-192.svg",
        output: "pwa-192.png",
        size: 192,
    },
    {
        input: "pwa-512.svg",
        output: "pwa-512.png",
        size: 512,
    },
    {
        input: "pwa-maskable-512.svg",
        output: "pwa-maskable-512.png",
        size: 512,
    },
];

for (const icon of icons) {
    await sharp(resolve(publicDir, icon.input))
        .resize(icon.size, icon.size)
        .png()
        .toFile(resolve(publicDir, icon.output));

    console.log(`Created public/${icon.output}`);
}
