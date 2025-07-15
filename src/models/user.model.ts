import { Schema, model } from 'mongoose';

interface IUser {
    username: string;
    deptShort: string;
    deptLong: string;
    password: string;
    access: string; // e.g., 'full', 'limited'
}

const UserSchema = new Schema<IUser>({
    username: { type: String, required: true, unique: true },
    deptShort: { type: String, required: true },
    deptLong: { type: String, required: true },
    password: { type: String, required: true },
    access: { type: String, required: true, enum: ['full', 'limited'], default: 'limited' }
});

export default model<IUser>('User', UserSchema);
