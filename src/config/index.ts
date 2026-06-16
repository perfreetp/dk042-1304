import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  database: {
    path: process.env.DB_PATH || './data/zombie_car.db',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
