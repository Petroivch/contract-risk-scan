export interface SqliteMigration {
  id: number;
  name: string;
  statements: string[];
}

export const LOCAL_CACHE_MIGRATIONS: SqliteMigration[] = [];
