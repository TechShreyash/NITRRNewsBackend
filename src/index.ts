// src/index.ts
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import newsRoutes from './routes/news';
import uploadRoutes from './routes/upload';
import eventRouter from './routes/events';
import dataRouter from './routes/data'
import accountRouter from './routes/account';
import newsGroupedRouter from './routes/news.grouped';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', eventRouter);
app.use('/api/data', dataRouter);
app.use('/api/account', accountRouter);
app.use('/api/news/grouped', newsGroupedRouter);



const start = async () => {
    await connectDB();
    app.listen(process.env.PORT, () =>
        console.log(`🚀 API ready on http://localhost:${process.env.PORT}`)
    );
};

start();
