const Database = require('better-sqlite3');
const path = require('path');

function initDatabase() {
    // Membuka database (akan otomatis membuat file jika belum ada)
    const db = new Database(path.join(process.cwd(), 'database.sqlite'), { verbose: console.log });

    // 1. Tabel Users
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `).run();

    // 2. Tabel Products (Layanan Jasa)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            stock INTEGER DEFAULT 0
        )
    `).run();

    // 3. Tabel Orders (Induk Transaksi)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_price INTEGER NOT NULL,
            status TEXT DEFAULT 'paid',
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `).run();

    // 4. Tabel Order Details (Rincian Transaksi)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS order_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal INTEGER NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `).run();

    // Data Awal Jasa jika kosong
    const productCount = db.prepare('SELECT COUNT(*) as total FROM products').get();
    if (productCount.total === 0) {
        const insertProduct = db.prepare(`
            INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)
        `);
        
        // Menggunakan transaksi agar eksekusi data awal lebih cepat dan aman
        const insertInitialProducts = db.transaction(() => {
            insertProduct.run('Deep Cleaning', 500000, 'Pembersihan menyeluruh termasuk area tersembunyi, kerak kamar mandi, dan debu tebal.', 5);
            insertProduct.run('Regular Cleaning', 200000, 'Pembersihan harian standar seperti menyapu, mengepel, dan merapikan tempat tidur.', 10);
            insertProduct.run('Fogging / Disinfektan', 350000, 'Penyemprotan cairan disinfektan untuk membunuh bakter dan virus di dalam rumah.', 3);
        });
        
        insertInitialProducts();
    }

    // Otomatis buat Akun Admin dummy jika belum ada
    const adminCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE email = 'superadmin@mail.com'").get();
    if (adminCount.total === 0) {
        const insertUser = db.prepare(`
            INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
        `);

        const insertInitialUsers = db.transaction(() => {
            insertUser.run('Admin Super', 'superadmin@mail.com', 'admin123', 'admin');
            insertUser.run('Faqih Pelanggan', 'faqih@mail.com', 'user123', 'user');
        });

        insertInitialUsers();
    }

    return db;
}

module.exports = initDatabase;