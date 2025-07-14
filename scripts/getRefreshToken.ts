#!/usr/bin/env ts-node                     // ↩ makes the file runnable

import { google } from 'googleapis';
import readline from 'node:readline/promises';
import open from 'open';
import 'dotenv/config';

(async () => {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
  const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

  await open(authUrl);                                         // ⬅ no TS1309
  const rl   = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await rl.question('Paste code: ');
  rl.close();

  const { tokens } = await oauth2.getToken(code.trim());
  console.log('Refresh token:', tokens.refresh_token);
})();
