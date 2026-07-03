const initDatabase = require("../database");

// ==========================================
// 1. MODUL USER / PELANGGAN
// ==========================================

const getAllServices = async (req, res) => {
  try {
    const db = await initDatabase();
    const result = await db.execute(
      "SELECT * FROM products WHERE stock > 0 ORDER BY id DESC",
    );
    const services = result.rows;

    res.render("index", {
      services,
      user: req.session.user || null,
    });
  } catch (error) {
    res.status(500).send("Gagal memuat layanan: " + error.message);
  }
};

const processOrder = async (req, res) => {
  const productId = parseInt(req.body.product_id);
  const quantity = parseInt(req.body.quantity);

  if (!productId || !quantity || quantity <= 0) {
    return res.redirect("/");
  }

  try {
    const db = await initDatabase();
    const result = await db.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [productId],
    });
    const product = result.rows[0];

    if (!product) {
      return res.status(404).send("Layanan jasa tidak ditemukan.");
    }
    if (product.stock < quantity) {
      return res.status(400).send("Maaf, sisa kuota sesi tidak mencukupi.");
    }

    const total = product.price * quantity;

    res.render("beli", { product, quantity, total });
  } catch (error) {
    res.status(500).send("Gagal memproses review order: " + error.message);
  }
};

const confirmOrder = async (req, res) => {
  const userId = req.session.user.id;
  const productId = parseInt(req.body.product_id);
  const quantity = parseInt(req.body.quantity);

  if (!productId || !quantity || quantity <= 0) {
    return res.redirect("/");
  }

  try {
    const db = await initDatabase();

    // PERBAIKAN: Tambahkan argumen "write" ke dalam db.transaction()
    const orderId = await db.transaction("write", async (tx) => {
      // 1. Ambil data stok produk terupdate di dalam transaksi
      const productResult = await tx.execute({
        sql: "SELECT price, stock FROM products WHERE id = ?",
        args: [productId],
      });
      const product = productResult.rows[0];

      if (!product || product.stock < quantity) {
        throw new Error(
          "Layanan tidak valid atau kuota harian habis mendadak.",
        );
      }

      const subtotal = product.price * quantity;
      const totalPrice = subtotal;

      // 2. Masukkan data ke tabel orders
      const orderResult = await tx.execute({
        sql: "INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, 'paid')",
        args: [userId, totalPrice],
      });

      // Konversi BigInt dari lastInsertRowid menjadi Number biasa
      const newOrderId = Number(orderResult.lastInsertRowid.toString());

      // 3. Masukkan rincian detail item ke order_details
      await tx.execute({
        sql: "INSERT INTO order_details (order_id, product_id, quantity, subtotal) VALUES (?, ?, ?, ?)",
        args: [newOrderId, productId, quantity, subtotal],
      });

      // 4. Potong stok kuota produk
      await tx.execute({
        sql: "UPDATE products SET stock = stock - ? WHERE id = ?",
        args: [quantity, productId],
      });

      // Kembalikan orderId keluar dari blok transaksi jika sukses
      return newOrderId;
    });

    // Transaksi otomatis COMMIT jika berhasil sampai sini
    res.redirect(`/struk?order_id=${orderId}`);
  } catch (error) {
    // Transaksi otomatis ROLLBACK oleh LibSQL jika ada error di dalam blok `db.transaction`
    console.error("Detail Error Transaksi:", error.message);
    res.status(400).send("Transaksi gagal didebet: " + error.message);
  }
};

const getReceipt = async (req, res) => {
  // 1. Validasi parameter query order_id
  if (!req.query.order_id) {
    return res.redirect("/");
  }

  const orderId = parseInt(req.query.order_id, 10);

  // 2. Validasi apakah user sudah login dan memiliki ID di session
  if (!req.session.user || !req.session.user.id) {
    return res
      .status(401)
      .send("Sesi Anda telah berakhir. Silakan login kembali.");
  }

  const userId = parseInt(req.session.user.id, 10);

  // 3. Cek apakah hasil parsing menghasilkan NaN (Not a Number)
  if (isNaN(orderId) || isNaN(userId)) {
    return res
      .status(400)
      .send(
        "Gagal memuat rincian struk: Format ID transaksi atau Pengguna tidak valid.",
      );
  }

  try {
    const db = await initDatabase();

    // Ambil data induk order
    const orderResult = await db.execute({
      sql: `SELECT orders.*, users.name as customer_name 
                  FROM orders 
                  JOIN users ON orders.user_id = users.id 
                  WHERE orders.id = ? AND orders.user_id = ?`,
      args: [orderId, userId],
    });
    const order = orderResult.rows[0];

    // Jika transaksi tidak ditemukan atau bukan milik user yang login
    if (!order) {
      return res
        .status(404)
        .send(
          "Struk transaksi tidak ditemukan atau Anda tidak memiliki akses.",
        );
    }

    // Ambil rincian item order
    const detailsResult = await db.execute({
      sql: `SELECT order_details.*, products.name as service_name 
                  FROM order_details 
                  JOIN products ON order_details.product_id = products.id 
                  WHERE order_details.order_id = ?`,
      args: [orderId],
    });
    const details = detailsResult.rows;

    res.render("struk", { order, details });
  } catch (error) {
    console.error("Error pada getReceipt:", error);
    res.status(500).send("Gagal memuat rincian struk: " + error.message);
  }
};

const getAboutPage = (req, res) => {
  res.render("tentang", { user: req.session.user || null });
};

// ==========================================
// 2. MODUL AUTHENTICATION (LOGIN & REGISTER)
// ==========================================

const getRegisterPage = (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("auth/register");
};

const handleRegister = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const db = await initDatabase();
    const existingResult = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });

    if (existingResult.rows.length > 0) {
      return res.render("auth/register", {
        error: "Email ini sudah terdaftar! Silakan gunakan email lain.",
      });
    }

    await db.execute({
      sql: "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      args: [name, email, password, "customer"],
    });

    res.render("auth/register", {
      success: "Registrasi berhasil! Silakan masuk menggunakan akun Anda.",
    });
  } catch (e) {
    res.render("auth/register", {
      error: "Terjadi kesalahan sistem: " + e.message,
    });
  }
};

const getLoginPage = (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "admin")
      return res.redirect("/admin/dashboard");
    return res.redirect("/");
  }
  res.render("auth/login");
};

const handleLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const db = await initDatabase();
    const userResult = await db.execute({
      sql: "SELECT * FROM users WHERE email = ? AND password = ?",
      args: [email, password],
    });
    const user = userResult.rows[0];

    if (user) {
      req.session.user = user;
      if (user.role === "admin") return res.redirect("/admin/dashboard");
      return res.redirect("/");
    }
    res.render("auth/login", { error: "Email atau password salah!" });
  } catch (e) {
    res.render("auth/login", {
      error: "Terjadi kesalahan sistem: " + e.message,
    });
  }
};

const handleLogout = (req, res) => {
  req.session.destroy();
  res.redirect("/");
};

// ==========================================
// 3. MODUL ADMIN PANEL (CRUD LAYANAN JASA)
// ==========================================

const getAdminDashboard = async (req, res) => {
  try {
    const db = await initDatabase();
    const totalLayananRes = await db.execute(
      "SELECT COUNT(*) as c FROM products",
    );
    const totalPesananRes = await db.execute(
      "SELECT COUNT(*) as c FROM orders",
    );

    res.render("admin/dashboard", {
      totalLayanan: totalLayananRes.rows[0].c,
      totalPesanan: totalPesananRes.rows[0].c,
    });
  } catch (error) {
    res.status(500).send("Error dashboard: " + error.message);
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const db = await initDatabase();
    const result = await db.execute("SELECT * FROM products ORDER BY id DESC");
    res.render("admin/product-list", {
      services: result.rows,
      msg: req.query.msg || null,
    });
  } catch (error) {
    res.status(500).send("Error memuat daftar produk: " + error.message);
  }
};

const getAdminProductAdd = (req, res) => {
  res.render("admin/product-add");
};

const handleAdminProductAdd = async (req, res) => {
  const { name, price, stock, description } = req.body;

  if (!name || parseInt(price) <= 0 || parseInt(stock) < 0) {
    return res.render("admin/product-add", {
      error: "Formulir tidak valid. Pastikan harga dan kuota terisi benar.",
    });
  }

  try {
    const db = await initDatabase();
    await db.execute({
      sql: "INSERT INTO products (name, price, stock, description) VALUES (?, ?, ?, ?)",
      args: [name.trim(), parseInt(price), parseInt(stock), description.trim()],
    });
    res.redirect("/admin/products");
  } catch (error) {
    res.render("admin/product-add", {
      error: "Gagal menyimpan data: " + error.message,
    });
  }
};

const getAdminProductEdit = async (req, res) => {
  try {
    const db = await initDatabase();
    const result = await db.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [req.params.id],
    });
    const product = result.rows[0];
    if (!product) return res.redirect("/admin/products");

    res.render("admin/product-edit", { product });
  } catch (error) {
    res.redirect("/admin/products");
  }
};

const handleAdminProductEdit = async (req, res) => {
  const { name, price, stock, description } = req.body;
  const id = req.params.id;

  if (!name || parseInt(price) <= 0 || parseInt(stock) < 0) {
    return res.render("admin/product-edit", {
      product: { id, name, price, stock, description },
      error: "Isian data tidak valid.",
    });
  }

  try {
    const db = await initDatabase();
    await db.execute({
      sql: "UPDATE products SET name=?, price=?, stock=?, description=? WHERE id=?",
      args: [
        name.trim(),
        parseInt(price),
        parseInt(stock),
        description.trim(),
        id,
      ],
    });
    res.redirect("/admin/products");
  } catch (error) {
    res.render("admin/product-edit", {
      product: { id, name, price, stock, description },
      error: "Gagal memperbarui data: " + error.message,
    });
  }
};

const handleAdminProductDelete = async (req, res) => {
  try {
    const db = await initDatabase();
    await db.execute({
      sql: "DELETE FROM products WHERE id = ?",
      args: [req.params.id],
    });
    res.redirect("/admin/products?msg=success_delete");
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
  handleAdminProductDelete,
};
