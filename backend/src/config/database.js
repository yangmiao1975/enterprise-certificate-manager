const { promisify } = require('util');

class DatabaseConfig {
  constructor() {
    this.config = {
      type: process.env.DB_TYPE || 'sqlite',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'certificate_manager',
      username: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      // SQLite specific
      filename: process.env.DATABASE_URL || './data/certificates.db',
      // Cloud SQL specific
      instanceConnectionName: process.env.DB_INSTANCE_CONNECTION_NAME || '',
      // Connection pooling
      pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000
      }
    };
  }

  async createConnection() {
    switch (this.config.type.toLowerCase()) {
      case 'sqlite':
        return this.createSQLiteConnection();
      case 'postgresql':
      case 'postgres':
        return this.createPostgreSQLConnection();
      case 'mysql':
        return this.createMySQLConnection();
      case 'cloud-sql-postgres':
        return this.createCloudSQLPostgreSQLConnection();
      case 'cloud-sql-mysql':
        return this.createCloudSQLMySQLConnection();
      case 'spanner':
        return this.createSpannerConnection();
      default:
        throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  async createSQLiteConnection() {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const { open } = require('sqlite');
      
      const db = await open({
        filename: this.config.filename,
        driver: sqlite3.Database
      });

      // Add async wrapper methods
      db.runAsync = promisify(db.run.bind(db));
      db.getAsync = promisify(db.get.bind(db));
      db.allAsync = promisify(db.all.bind(db));

      return db;
    } catch (error) {
      throw new Error('SQLite support requires "sqlite3" package. Install with: npm install sqlite3');
    }
  }

  async createPostgreSQLConnection() {
    try {
      const { Pool } = require('pg');
    } catch (error) {
      throw new Error('PostgreSQL support requires "pg" package. Install with: npm install pg');
    }
    const { Pool } = require('pg');
    
    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idle
    });

    // Add async wrapper methods for compatibility
    pool.runAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return { lastID: result.rows[0]?.id, changes: result.rowCount };
      } finally {
        client.release();
      }
    };

    pool.getAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows[0];
      } finally {
        client.release();
      }
    };

    pool.allAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    };

    return pool;
  }

  async createMySQLConnection() {
    try {
      const mysql = require('mysql2/promise');
    } catch (error) {
      throw new Error('MySQL support requires "mysql2" package. Install with: npm install mysql2');
    }
    const mysql = require('mysql2/promise');
    
    const pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      connectionLimit: this.config.pool.max,
      acquireTimeout: 60000,
      timezone: 'Z'
    });

    // Add async wrapper methods for compatibility
    pool.runAsync = async (sql, params = []) => {
      const [result] = await pool.execute(sql, params);
      return { lastID: result.insertId, changes: result.affectedRows };
    };

    pool.getAsync = async (sql, params = []) => {
      const [rows] = await pool.execute(sql, params);
      return rows[0];
    };

    pool.allAsync = async (sql, params = []) => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    };

    return pool;
  }

  async createCloudSQLPostgreSQLConnection() {
    const { Pool } = require('pg');
    
    const pool = new Pool({
      host: `/cloudsql/${this.config.instanceConnectionName}`,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idle
    });

    // Add the same wrapper methods as PostgreSQL
    return this.addPostgreSQLWrappers(pool);
  }

  async createCloudSQLMySQLConnection() {
    const mysql = require('mysql2/promise');
    
    const pool = mysql.createPool({
      socketPath: `/cloudsql/${this.config.instanceConnectionName}`,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      connectionLimit: this.config.pool.max,
      acquireTimeout: 60000,
      timezone: 'Z'
    });

    // Add the same wrapper methods as MySQL
    return this.addMySQLWrappers(pool);
  }

  async createSpannerConnection() {
    const { Spanner } = require('@google-cloud/spanner');
    
    const spanner = new Spanner({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT
    });

    const instance = spanner.instance(process.env.SPANNER_INSTANCE);
    const database = instance.database(this.config.database);

    // Add wrapper methods for Spanner
    database.runAsync = async (sql, params = []) => {
      const [rows] = await database.run({
        sql: sql,
        params: params
      });
      return { lastID: null, changes: rows.length };
    };

    database.getAsync = async (sql, params = []) => {
      const [rows] = await database.run({
        sql: sql,
        params: params
      });
      return rows[0] ? rows[0].toJSON() : null;
    };

    database.allAsync = async (sql, params = []) => {
      const [rows] = await database.run({
        sql: sql,
        params: params
      });
      return rows.map(row => row.toJSON());
    };

    return database;
  }

  addPostgreSQLWrappers(pool) {
    pool.runAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return { lastID: result.rows[0]?.id, changes: result.rowCount };
      } finally {
        client.release();
      }
    };

    pool.getAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows[0];
      } finally {
        client.release();
      }
    };

    pool.allAsync = async (sql, params = []) => {
      const client = await pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    };

    return pool;
  }

  addMySQLWrappers(pool) {
    pool.runAsync = async (sql, params = []) => {
      const [result] = await pool.execute(sql, params);
      return { lastID: result.insertId, changes: result.affectedRows };
    };

    pool.getAsync = async (sql, params = []) => {
      const [rows] = await pool.execute(sql, params);
      return rows[0];
    };

    pool.allAsync = async (sql, params = []) => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    };

    return pool;
  }

  getDialectSpecificSQL() {
    const dialects = {
      sqlite: {
        autoIncrement: 'INTEGER PRIMARY KEY AUTOINCREMENT',
        boolean: 'BOOLEAN',
        timestamp: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
        textType: 'TEXT',
        limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`
      },
      postgresql: {
        autoIncrement: 'SERIAL PRIMARY KEY',
        boolean: 'BOOLEAN',
        timestamp: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        textType: 'TEXT',
        limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`
      },
      mysql: {
        autoIncrement: 'INT AUTO_INCREMENT PRIMARY KEY',
        boolean: 'BOOLEAN',
        timestamp: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        textType: 'TEXT',
        limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`
      },
      spanner: {
        autoIncrement: 'INT64 NOT NULL',
        boolean: 'BOOL',
        timestamp: 'TIMESTAMP DEFAULT (CURRENT_TIMESTAMP())',
        textType: 'STRING(MAX)',
        limitOffset: (limit, offset) => `LIMIT ${limit} OFFSET ${offset}`
      }
    };

    return dialects[this.config.type.toLowerCase()] || dialects.sqlite;
  }
}

module.exports = DatabaseConfig;