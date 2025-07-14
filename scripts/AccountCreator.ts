// run  npx ts-node scripts/AccountCreator.ts

import bcrypt from 'bcrypt';
import 'dotenv/config';
import { connectDB } from '../src/db';
import User from '../src/models/user.model';

(async () => {
    await connectDB();

    const username = 'IT_ADMIN_1';
    const password = 'mypassword123';
    const department = 'IT';


    await User.create({
        username, department, password
    });
    console.log(
        `✅ User ${username} created with password: ${password}`
    );
    process.exit(0);
})();
