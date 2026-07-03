const initDatabase = require('../database');

// ==========================================
// 1. MODUL USER / PELANGGAN
// ==========================================

// Menggantikan index.php
const getAllServices = async (req, res) => {
    try {
        const db = await initDatabase(); // Asumsi inisialisasi koneksi awal tetap async
        const services = db.prepare('SELECT * FROM products WHERE stock > 0 ORDER BY id DESC').all();
        
        // Perbaikan sintaks: Menambahkan objek res.render yang terpotong di kode awal
        res.render('index', { 
            services, 
            user: req.session.user || null 
        });
    } catch (error) {
        res.status(500).send("Gagal memuat layanan: " + error.message);
    }
};

// TAHAP 1: Menampilkan Halaman Review Belanjaan & Opsi Pembayaran (beli.ejs)
const processOrder = async (req, res) => {
    const productId = parseInt(req.body.product_id);
    const quantity = parseInt(req.body.quantity);

    if (!productId || !quantity || quantity <= 0) {
        return res.redirect('/');
    }

    try {
        const db = await initDatabase();
        // better-sqlite3 menggunakan .get() langsung dari statement yang di-prepare
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        
        if (!product) {
            return res.status(404).send("Layanan jasa tidak ditemukan.");
        }
        if (product.stock < quantity) {
            return res.status(400).send("Maaf, sisa kuota sesi tidak mencukupi.");
        }

        const total = product.price * quantity;

        // Render ke halaman checkout (beli.ejs) membawa data rincian belanjaan
        res.render('beli', { product, quantity, total });
    } catch (error) {
        res.status(500).send("Gagal memproses review order: " + error.message);
    }
};

// TAHAP 2: Proses Eksekusi Database Setelah User Klik "Konfirmasi & Bayar Sekarang"
const confirmOrder = async (req, res) => {
    const userId = req.session.user.id;
    const productId = parseInt(req.body.product_id);
    const quantity = parseInt(req.body.quantity);
    const paymentMethod = req.body.payment_method; 

    if (!productId || !quantity || quantity <= 0) {
        return res.redirect('/');
    }

    const db = await initDatabase();

    try {
        // Kontrol transaksi sinkronus pada better-sqlite3
        db.prepare('BEGIN').run();

        const product = db.prepare('SELECT price, stock FROM products WHERE id = ?').get(productId);
        if (!product || product.stock < quantity) {
            throw new Error("Layanan tidak valid atau kuota harian habis mendadak.");
        }

        const subtotal = product.price * quantity;
        const totalPrice = subtotal;

        // A. Masukkan data ke induk transaksi orders
        const orderResult = db.prepare(
            "INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, 'paid')"
        ).run(userId, totalPrice);
        
        // better-sqlite3 mengembalikan ID terakhir lewat properti .lastInsertRowid
        const orderId = orderResult.lastInsertRowid;

        // B. Masukkan rincian detail item
        db.prepare(
            "INSERT INTO order_details (order_id, product_id, quantity, subtotal) VALUES (?, ?, ?, ?)"
        ).run(orderId, productId, quantity, subtotal);

        // C. Potong stok kuota harian jasa secara aman
        db.prepare(
            "UPDATE products SET stock = stock - ? WHERE id = ?"
        ).run(quantity, productId);

        db.prepare('COMMIT').run();
        
        // Oper ke halaman struk/invoice akhir
        res.redirect(`/struk?order_id=${orderId}`);

    } catch (error) {
        // Rollback jika terjadi error
        try { db.prepare('ROLLBACK').run(); } catch (_) {}
        res.status(400).send("Transaksi gagal didebet: " + error.message);
    }
};

// Menggantikan struk.php
const getReceipt = async (req, res) => {
    if (!req.query.order_id) return res.redirect('/');
    
    const orderId = parseInt(req.query.order_id);
    const userId = req.session.user.id;

    try {
        const db = await initDatabase();

        const order = db.prepare(`
            SELECT orders.*, users.name as customer_name 
            FROM orders 
            JOIN users ON orders.user_id = users.id 
            WHERE orders.id = ? AND orders.user_id = ?
        `).get(orderId, userId);

        if (!order) return res.redirect('/');

        const details = db.prepare(`
            SELECT order_details.*, products.name as service_name 
            FROM order_details 
            JOIN products ON order_details.product_id = products.id 
            WHERE order_details.order_id = ?
        `).all(orderId);

        res.render('struk', { order, details });
    } catch (error) {
        res.status(500).send("Gagal memuat rincian struk: " + error.message);
    }
};

// Menggantikan tentang.php
const getAboutPage = (req, res) => {
    res.render('tentang', { user: req.session.user || null });
};


// ==========================================
// 2. MODUL AUTHENTICATION (LOGIN & REGISTER)
// ==========================================

const getRegisterPage = (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/register');
};

const handleRegister = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const db = await initDatabase();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        
        if (existing) {
            return res.render('auth/register', { error: 'Email ini sudah terdaftar! Silakan gunakan email lain.' });
        }
        
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(name, email, password, 'customer');
        res.render('auth/register', { success: 'Registrasi berhasil! Silakan masuk menggunakan akun Anda.' });
    } catch (e) {
        res.render('auth/register', { error: 'Terjadi kesalahan sistem: ' + e.message });
    }
};

const getLoginPage = (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
        return res.redirect('/');
    }
    res.render('auth/login');
};

const handleLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = await initDatabase();
        const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
        
        if (user) {
            req.session.user = user;
            if (user.role === 'admin') return res.redirect('/admin/dashboard');
            return res.redirect('/');
        }
        res.render('auth/login', { error: 'Email atau password salah!' });
    } catch (e) {
        res.render('auth/login', { error: 'Terjadi kesalahan sistem: ' + e.message });
    }
};

const handleLogout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};


// ==========================================
// 3. MODUL ADMIN PANEL (CRUD LAYANAN JASA)
// ==========================================

// Menggantikan admin/dashboard.php
const getAdminDashboard = async (req, res) => {
    try {
        const db = await initDatabase();
        const totalLayanan = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
        const totalPesanan = db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
        res.render('admin/dashboard', { totalLayanan, totalPesanan });
    } catch (error) {
        res.status(500).send("Error dashboard: " + error.message);
    }
};

// Menggantikan admin/product-list.php
const getAdminProducts = async (req, res) => {
    try {
        const db = await initDatabase();
        const services = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
        res.render('admin/product-list', { services, msg: req.query.msg || null });
    } catch (error) {
        res.status(500).send("Error memuat daftar produk: " + error.message);
    }
};

// Menggantikan tampilan admin/product-add.php
const getAdminProductAdd = (req, res) => {
    res.render('admin/product-add');
};

// Menggantikan proses submit data admin/product-add.php
const handleAdminProductAdd = async (req, res) => {
    const { name, price, stock, description } = req.body;
    
    if (!name || parseInt(price) <= 0 || parseInt(stock) < 0) {
        return res.render('admin/product-add', { error: 'Formulir tidak valid. Pastikan harga dan kuota terisi benar.' });
    }

    try {
        const db = await initDatabase();
        db.prepare(
            'INSERT INTO products (name, price, stock, description) VALUES (?, ?, ?, ?)'
        ).run(name.trim(), parseInt(price), parseInt(stock), description.trim());
        res.redirect('/admin/products');
    } catch (error) {
        res.render('admin/product-add', { error: 'Gagal menyimpan data: ' + error.message });
    }
};

// Menggantikan tampilan admin/product-edit.php
const getAdminProductEdit = async (req, res) => {
    try {
        const db = await initDatabase();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) return res.redirect('/admin/products');
        
        res.render('admin/product-edit', { product });
    } catch (error) {
        res.redirect('/admin/products');
    }
};

// Menggantikan proses update data admin/product-edit.php
const handleAdminProductEdit = async (req, res) => {
    const { name, price, stock, description } = req.body;
    const id = req.params.id;

    if (!name || parseInt(price) <= 0 || parseInt(stock) < 0) {
        return res.render('admin/product-edit', { product: { id, name, price, stock, description }, error: 'Isian data tidak valid.' });
    }

    try {
        const db = await initDatabase();
        db.prepare(
            'UPDATE products SET name=?, price=?, stock=?, description=? WHERE id=?'
        ).run(name.trim(), parseInt(price), parseInt(stock), description.trim(), id);
        res.redirect('/admin/products');
    } catch (error) {
        res.render('admin/product-edit', { product: { id, name, price, stock, description }, error: 'Gagal memperbarui data: ' + error.message });
    }
};

// Menggantikan aksi penghapusan data di admin/product-list.php
const handleAdminProductDelete = async (req, res) => {
    try {
        const db = await initDatabase();
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.redirect('/admin/products?msg=success_delete');
    } catch (error) {
        res.status(500).send("Gagal menghapus data: " + error.message);
    }
};

module.exports = {
    getAllServices,
    processOrder,
    confirmOrder,
    getReceipt,
    getAboutPage,
    getRegisterPage,
    handleRegister,
    getLoginPage,
    handleLogin,
    handleLogout,
    getAdminDashboard,
    getAdminProducts,
    getAdminProductAdd,
    handleAdminProductAdd,
    getAdminProductEdit,
    handleAdminProductEdit,
    handleAdminProductDelete
};