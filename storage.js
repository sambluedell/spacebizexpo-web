/* Unified storage: Upstash Redis on Vercel, JSON files locally */
const fs = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');

const isVercel = process.env.VERCEL === '1';
const DATA_DIR = path.join(__dirname, 'data');

let redis = null;
if (isVercel) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
  }
}

async function readAll(key) {
  if (redis) {
    return await redis.lrange(key, 0, -1);
  }
  const fp = path.join(DATA_DIR, `${key}.json`);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

async function writeAll(key, items) {
  if (redis) {
    await redis.del(key);
    if (items.length > 0) {
      await redis.rpush(key, ...items.map(i => JSON.stringify(i)));
    }
    return;
  }
  fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(items, null, 2));
}

async function add(key, item) {
  const items = await readAll(key);
  const newItem = { id: Date.now(), ...item };
  items.push(newItem);
  await writeAll(key, items);
  return newItem;
}

async function updateOne(key, id, updates) {
  const items = await readAll(key);
  const idx = items.findIndex(i => i.id == id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  await writeAll(key, items);
  return items[idx];
}

async function remove(key, id) {
  let items = await readAll(key);
  items = items.filter(i => i.id != id);
  await writeAll(key, items);
  return true;
}

// Seed JSON data into Redis on first run (Vercel only)
async function seedIfEmpty() {
  if (!redis) return;
  for (const name of ['registrations', 'news', 'exhibitors', 'media', 'downloads']) {
    const exists = await redis.exists(name);
    if (!exists) {
      const fp = path.join(DATA_DIR, `${name}.json`);
      if (fs.existsSync(fp)) {
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        if (data.length > 0) {
          await redis.rpush(name, ...data.map(i => JSON.stringify(i)));
          console.log(`  Seeded ${name}: ${data.length} items`);
        }
      }
    }
  }
}

module.exports = { readAll, writeAll, add, updateOne, remove, seedIfEmpty, isVercel };
