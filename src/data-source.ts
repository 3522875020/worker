import { DataSource } from "typeorm";
import { Mail } from "./entities/Mail";
import { User } from "./entities/User";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const ca = fs.readFileSync(path.join(__dirname, '../ca.crt')).toString();

console.log('Database connection config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USER,
    database: process.env.DB_NAME
});

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    entities: [Mail, User],
    subscribers: [],
    migrations: [],
    ssl: {
        rejectUnauthorized: true,
        ca
    }
}); 