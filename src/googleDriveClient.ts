// src/googleDriveClient.ts
import { TsGoogleDrive } from 'ts-google-drive';
import path from 'node:path';
import fs from 'node:fs/promises';
import 'dotenv/config';

/* ---------------------------------------------------------------------------
   1.  OAuth-2 client built from ENV variables
       -------------------------------------------------------------
       • GOOGLE_CLIENT_ID        – OAuth client-ID you created in Google Cloud
       • GOOGLE_CLIENT_SECRET    – matching client secret
       • GOOGLE_REFRESH_TOKEN    – one-time token you generated with "offline" access
--------------------------------------------------------------------------- */

const drive = new TsGoogleDrive({
  oAuthCredentials: {
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,         // long-lived
  },
  oauthClientOptions: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // redirectUri is optional for refresh-token flows but you can add it:
    // redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
});

export interface DriveMeta {
  id: string;
  mimeType: string;
  embedLink: string;
}

/* ---------------------------------------------------------------------------
   uploadAndGetMeta() – unchanged except it now runs under OAuth creds
--------------------------------------------------------------------------- */
export async function uploadAndGetMeta(localPath: string): Promise<DriveMeta> {
  // 1. Upload into the user’s My Drive (15 GB free) – parent is optional
  const file = await drive.upload(localPath, {
    parent: process.env.DRIVE_ROOT_ID,     // leave undefined for My Drive root
  });
  console.log('File uploaded:', file);

  // 2. Public embed link (image ↔ all other types)
  const embedLink = file.mimeType.startsWith('image/')
    ? `https://drive.google.com/uc?export=view&id=${file.id}`
    : `https://drive.google.com/file/d/${file.id}/preview`;

  // 3. Delete the tmp file that Multer wrote
  await fs.unlink(localPath);

  return { id: file.id, mimeType: file.mimeType, embedLink };
}
