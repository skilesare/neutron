import {copyFile, mkdir, readdir} from "node:fs/promises";
import {join, resolve} from "node:path";

const project = resolve(import.meta.dirname, "..");
const source = resolve(project, "..", "submission-assets", "calendar");
const destination = join(project, "public", "assets");
await mkdir(destination, {recursive: true});

const names = (await readdir(source)).filter((name) => /\.(?:jpe?g|png)$/i.test(name));
for (const name of names) await copyFile(join(source, name), join(destination, name));

const icon = resolve(project, "..", "apps", "calendar", "public", "static", "icon.png");
await copyFile(icon, join(destination, "calendar-icon.png"));
console.log(`Prepared ${names.length + 1} Calendar video assets.`);
