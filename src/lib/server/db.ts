import { MongoClient } from 'mongodb';
import { MONGODB_URI, DOWNLOAD_DIR } from './config';
import type { DownloadRecord } from './downloads';
import path from 'path';
import fs from 'fs';

const client = new MongoClient(MONGODB_URI);
let dbInstance: any = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  try {
    await client.connect();
    console.log('[db] Connected to MongoDB');
    dbInstance = client.db('youtube-download');
    // Create indexes
    await dbInstance.collection('downloads').createIndex({ id: 1 }, { unique: true });
    await dbInstance.collection('downloads').createIndex({ status: 1 });
    await dbInstance.collection('downloads').createIndex({ createdAt: -1 });
    return dbInstance;
  } catch (e) {
    console.error('[db] MongoDB connection error:', e);
    throw e;
  }
}

export async function dbUpsertDownload(rec: DownloadRecord) {
  try {
    const db = await getDb();
    // MongoDB doesn't like undefined in $set sometimes, or it's fine.
    // But we should be careful with _id.
    const { _id, ...rest } = rec as any;
    await db.collection('downloads').updateOne(
      { id: rec.id },
      { $set: rest },
      { upsert: true }
    );
  } catch (e) {
    console.error('[db] upsert error', e);
  }
}

export async function dbLoadDownloads(): Promise<DownloadRecord[]> {
  try {
    const db = await getDb();
    const docs = await db.collection('downloads').find().toArray();
    return docs.map((d: any) => {
      const { _id, ...rest } = d;
      return rest as DownloadRecord;
    });
  } catch (e) {
    console.error('[db] load error', e);
    return [];
  }
}

export async function dbCompletedHistory(): Promise<Array<{ title: string; path: string; thumbnail: string }>> {
  try {
    const db = await getDb();
    const rows = await db.collection('downloads')
      .find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .project({ title: 1, relPath: 1, thumbnail: 1 })
      .toArray();

    return rows.map((r: any) => ({
      title: r.title,
      path: `/${path.join('files', r.relPath)}`,
      thumbnail: r.thumbnail || '/favicon.png'
    }));
  } catch (e) {
    console.error('[db] history error', e);
    return [];
  }
}

export async function dbDeleteByRel(relPath: string) {
  try {
    const db = await getDb();
    await db.collection('downloads').deleteOne({ relPath });
  } catch (e) {
    console.error('[db] delete error', e);
  }
}

export async function dbMigrateFromLegacy() {
  try {
    const db = await getDb();
    const count = await db.collection('downloads').countDocuments();
    if (count > 0) return;

    const JSON_STATE = path.join(DOWNLOAD_DIR, 'downloads.json');
    if (fs.existsSync(JSON_STATE)) {
      try {
        const arr = JSON.parse(fs.readFileSync(JSON_STATE, 'utf-8')) as DownloadRecord[];
        if (arr.length > 0) {
          console.log('[db] Migrating %d records from JSON to MongoDB', arr.length);
          for (const rec of arr) {
            const { _id, ...rest } = rec as any;
            await db.collection('downloads').updateOne({ id: rec.id }, { $set: rest }, { upsert: true });
          }
        }
      } catch (e) {
        console.warn('[db] Migration failed', e);
      }
    }
  } catch (e) {
    console.error('[db] migration error', e);
  }
}
export async function dbUpsertUser(user: any) {
  try {
    const db = await getDb();
    await db.collection('users').updateOne(
      { username: user.username },
      { $set: user },
      { upsert: true }
    );
  } catch (e) {
    console.error('[db] upsert user error', e);
  }
}

export async function dbGetUser(username: string) {
  try {
    const db = await getDb();
    return await db.collection('users').findOne({ username });
  } catch (e) {
    console.error('[db] get user error', e);
    return null;
  }
}
