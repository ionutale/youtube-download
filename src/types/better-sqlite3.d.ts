declare module 'better-sqlite3' {
  export default class Database {
    constructor(filename: string, options?: any);
    pragma(sql: string): void;
    prepare<T = any>(sql: string): { all: (...args: any[]) => T[]; get: (...args: any[]) => T; run: (...args: any[]) => any };
    exec(sql: string): void;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
  }
}
