import 'reflect-metadata';
import { DataSource, EntityTarget, Repository, ObjectLiteral } from 'typeorm';
import { config } from './index';
import entities from '../entities';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';

const dbPath = path.resolve(process.cwd(), config.database.path);

export const AppDataSource = new DataSource({
  type: 'sqljs',
  autoSave: true,
  location: dbPath,
  entities,
  synchronize: config.nodeEnv === 'development',
  logging: config.nodeEnv === 'development',
  migrations: [path.join(__dirname, '../migrations/**/*.ts')],
  subscribers: [path.join(__dirname, '../subscribers/**/*.ts')],
});

export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    if (!AppDataSource.isInitialized) {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `node_modules/sql.js/dist/${file}`,
      });
      
      (AppDataSource.options as any).driver = SQL;
      
      await AppDataSource.initialize();
      console.log('Database connected successfully');
    }
    return AppDataSource;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

export const getRepository = <T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> => {
  return AppDataSource.getRepository(entity);
};

export default AppDataSource;
