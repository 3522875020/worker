import { DataSource } from "typeorm";
import { Mail } from "./entities/Mail";
import { User } from "./entities/User";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "temp_email",
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    entities: [Mail, User],
    subscribers: [],
    migrations: [],
    ssl: {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA
    }
}); 