// run  npx ts-node scripts/AccountCreator.ts

import bcrypt from 'bcrypt';
import 'dotenv/config';
import { connectDB } from '../src/db';
import User from '../src/models/user.model';

(async () => {
    await connectDB();

    const username = 'CS_ADMIN_1';
    const password = 'mypassword123';
    const deptShort = 'CS';
    const deptLong = 'Computer Science';


    await User.create({
        username, deptShort, deptLong, password
    });
    console.log(
        `✅ User ${username} created with password: ${password}`
    );
    process.exit(0);
})();
