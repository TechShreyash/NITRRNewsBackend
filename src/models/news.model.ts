// src/models/news.model.ts
import { Schema, model } from 'mongoose';

interface IFileMeta {
  driveId: string;        // Google file ID
  mimeType: string;       // e.g. "image/png"
  embedLink: string;      // Drive embed URL
  originalName: string;   // ← NEW: human‑readable filename
}

interface INews {
  department: string;     // deptShort ("IT", "CSE", …)
  title: string;
  body: string;
  files: IFileMeta[];
  createdAt: Date;
}

/* ─── sub‑document for each attachment ─── */
const fileSchema = new Schema<IFileMeta>({
  driveId:      { type: String, required: true },
  mimeType:     { type: String, required: true },
  embedLink:    { type: String, required: true },
  originalName: { type: String, required: true }   // ensure it’s stored
});

/* ─── main News document ─── */
const newsSchema = new Schema<INews>({
  department: { type: String, required: true },
  title:      { type: String, required: true },
  body:       { type: String, required: true },
  files:      { type: [fileSchema], default: [] },
  createdAt:  { type: Date, default: Date.now }
});

export default model<INews>('News', newsSchema);
