import { Schema, model } from 'mongoose';

interface IFileMeta {
  driveId: string;
  mimeType: string;
  embedLink: string;
}

interface INews {
  department: string;
  title: string;
  body: string;
  files: IFileMeta[];
  createdAt: Date;
}

const fileSchema = new Schema<IFileMeta>({
  driveId: String,
  mimeType: String,
  embedLink: String
});

const newsSchema = new Schema<INews>({
  department: String,
  title: String,
  body: String,
  files: [fileSchema],
  createdAt: { type: Date, default: Date.now }
});

export default model<INews>('News', newsSchema);
