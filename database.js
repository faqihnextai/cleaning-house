const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function initDatabase() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // 1. Tabel Users
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `);

    // 2. Tabel Products (Layanan Jasa)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            stock INTEGER DEFAULT 0
        )
    `);

    // 3. Tabel Orders (Induk Transaksi)
    await db.exec(`
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
    await db.exec(`
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
    const productCount = await db.get('SELECT COUNT(*) as total FROM products');
    if (productCount.total === 0) {
        await db.run(`
            INSERT INTO products (name, price, description, stock) VALUES 
            ('Deep Cleaning', 500000, 'Pembersihan menyeluruh termasuk area tersembunyi, kerak kamar mandi, dan debu tebal.', 5),
            ('Regular Cleaning', 200000, 'Pembersihan harian standar seperti menyapu, mengepel, dan merapikan tempat tidur.', 10),
            ('Fogging / Disinfektan', 350000, 'Penyemprotan cairan disinfektan untuk membunuh bakteri dan virus di dalam rumah.', 3)
        `);
    }

    // Otomatis buat Akun Admin dummy jika belum ada (Mirip init-admin.php)
    const adminCount = await db.get("SELECT COUNT(*) as total FROM users WHERE email = 'superadmin@mail.com'");
    if (adminCount.total === 0) {
        // Demi kesederhanaan, kita simpan plain text / atau bisa gunakan bcrypt jika mau.
        // Di sini kita gunakan string biasa agar langsung bisa dipakai login uji coba
        await db.run(`
            INSERT INTO users (name, email, password, role) 
            VALUES ('Admin Super', 'superadmin@mail.com', 'admin123', 'admin')
        `);
        
        // Buat satu akun user biasa untuk simulasi pemesanan pelanggan
        await db.run(`
            INSERT INTO users (name, email, password, role) 
            VALUES ('Faqih Pelanggan', 'faqih@mail.com', 'user123', 'user')
        `);
    }

    return db;
}

module.exports = initDatabase;