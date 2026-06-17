import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  database: 'valravn_db',
  user: 'postgres',
  password: 'yBeGCu9ZZHRkcNrveDNKwC8vtN3U',
  port: 5432,
});

export default pool;
