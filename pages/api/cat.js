import crypto from "crypto";
import path from "path";
import seedrandom from "seedrandom";
import sharp from "sharp";

const cache = new Map();
const dir = path.join(process.cwd(), "assets");

async function buildCat(parts, width) {
    const cat = await cacheCat(parts.slice(0, 3), width);

    const names = ["mouth", "accessorie"];
    const paths = names.map((name, i) => {
        const n = parts[i + 3].toString().padStart(2, "0");
        const png = `${name}_${n}.png`;
        return path.join(dir, png);
    });

    const resizedParts = await Promise.all(
        paths.map(p => sharp(p).resize(width, width).toBuffer())
    );

    return sharp(cat)
        .composite(resizedParts.map(input => ({ input })))
        .resize(width, width) // Ensure the final image is resized to the given width
        .png()
        .toBuffer();
}

async function cacheCat(parts, width) {
    const key = `${parts.join(" ")}_${width}`;
    if (cache.has(key)) return cache.get(key);

    const names = ["body", "fur", "eyes"];
    const paths = names.map((name, i) => {
        const n = parts[i].toString().padStart(2, "0");
        const png = `${name}_${n}.png`;
        return path.join(dir, png);
    });

    const resizedParts = await Promise.all(
        paths.map(p => sharp(p).resize(width, width).toBuffer())
    );

    const buffer = await sharp({
        create: {
            width: width,
            height: width,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite(resizedParts.map(input => ({ input })))
        .png()
        .toBuffer();

    cache.set(key, buffer);
    return buffer;
}

function hash(input) {
    return crypto.createHash("sha256").update(input ?? "").digest("hex");
}

function randInt(rng, n) {
    return Math.floor(rng() * n) + 1;
}

function randomParts(seed) {
    const rng = seedrandom(seed);
    return [15, 10, 15, 10, 20].map(n => randInt(rng, n));
}

export default async function handler(req, res) {
    let buffer;
    const width = req.query.width ? parseInt(req.query.width, 10) : 256; // Default to 256 if width is not provided

    if ("parts" in req.query) {
        const parts = req.query.parts.split(",").map(Number);
        try {
            buffer = await buildCat(parts, width);
        } catch (error) {
            console.error(error);
            return res.status(422).end();
        }
    } else {
        const seed = hash(req.query.name ?? "");
        const parts = randomParts(seed);

        if ("partDetails" in req.query) {
            return res.status(200).json(parts);
        }

        buffer = await buildCat(parts, width);
    }

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
}
