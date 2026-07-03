const { createClient } = require('@libsql/client');
const path = require('path');

async function initDatabase() {
    // Tentukan path ke folder /tmp jika di lingkungan Vercel
    const isVercel = process.env.VERCEL;
    const localDbPath = isVercel 
        ? '/tmp/database.sqlite' 
        : path.join(process.cwd(), 'database.sqlite');

    const client = createClient({
        url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined
    });

    // 1. Tabel Users
    await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `);

    // 2. Tabel Products (Layanan Jasa)
    await client.execute(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            stock INTEGER DEFAULT 0
        )
    `);

    // 3. Tabel Orders (Induk Transaksi)
    await client.execute(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_price INTEGER NOT NULL,
            status TEXT DEFAULT 'paid',
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // 4. Tabel Order Details (Rincian Transaksi)
    await client.execute(`
        CREATE TABLE IF NOT EXISTS order_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal INTEGER NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Data Awal Jasa jika kosong
    const productCount = await client.execute('SELECT COUNT(*) as total FROM products');
    if (productCount.rows[0].total === 0) {
        // Menggunakan batch untuk transaksi di libsql
        await client.batch([
            { sql: 'INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)', args: ['Deep Cleaning', 500000, 'Pembersihan menyeluruh termasuk area tersembunyi, kerak kamar mandi, dan debu tebal.', 5] },
            { sql: 'INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)', args: ['Regular Cleaning', 200000, 'Pembersihan harian standar seperti menyapu, mengepel, dan merapikan tempat tidur.', 10] },
            { sql: 'INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)', args: ['Fogging / Disinfektan', 350000, 'Penyemprotan cairan disinfektan untuk membunuh bakter dan virus di dalam rumah.', 3] }
        ]);
    }

    // Otomatis buat Akun Admin dummy jika belum ada
    const adminCount = await client.execute({
        sql: "SELECT COUNT(*) as total FROM users WHERE email = ?",
        args: ['superadmin@mail.com']
    });
    
    if (adminCount.rows[0].total === 0) {
        await client.batch([
            { sql: 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', args: ['Admin Super', 'superadmin@mail.com', 'admin123', 'admin'] },
            { sql: 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', args: ['Faqih Pelanggan', 'faqih@mail.com', 'user123', 'user'] }
        ]);
    }

    return client;
}

module.exports = initDatabase;