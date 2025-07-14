// src/googleDriveClient.ts
//---------------------------------------------------------------------
// Upload helper for Google Drive (Node.js).
// Requires env vars:
//   GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  GOOGLE_REFRESH_TOKEN
//   [optional] DRIVE_ROOT_ID  – target folder ID
//---------------------------------------------------------------------

import { google } from 'googleapis';
import fs   from 'node:fs';
import fsp  from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import 'dotenv/config';

/* ────────────────────── OAuth2 client ─────────────────────── */
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost'
);
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN! });

const drive = google.drive({ version: 'v3', auth: oauth2 });

/* ────────────────────── Public return type ─────────────────── */
export interface DriveMeta {
  id: string;
  mimeType: string;
  embedLink: string;
}

/**
 * Upload `localPath` to Drive.
 * Calls `onChunk(loaded,total)` for every progress tick.
 */
export async function uploadAndGetMeta(
  localPath: string,
  onChunk?: (loaded: number, total: number) => void
): Promise<DriveMeta> {
  const name     = path.basename(localPath);
  const mimeType = (mime.lookup(name) || 'application/octet-stream').toString();
  const size     = (await fsp.stat(localPath)).size;           // bytes

  const res = await drive.files.create(
    {
      requestBody: {
        name,
        parents: process.env.DRIVE_ROOT_ID ? [process.env.DRIVE_ROOT_ID] : undefined
      },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: 'id, mimeType',
      supportsAllDrives: true
    },
    {
      onUploadProgress: ev => {
        // ev.total is undefined in Node, so use our own `size`
        if (onChunk) onChunk(ev.bytesRead ?? ev.loaded, size);
      }
    }
  );

  /* Make the file publicly readable */
  const fileId = res.data.id!;
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  await fsp.unlink(localPath);

  const embedLink = mimeType.startsWith('image/')
    ? `https://drive.google.com/uc?export=view&id=${fileId}`
    : `https://drive.google.com/file/d/${fileId}/preview`;

  return { id: fileId, mimeType, embedLink };
}
