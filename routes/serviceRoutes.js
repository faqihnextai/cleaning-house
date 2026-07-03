const express = require('express');
const router = express.Router();
const { 
    getAllServices, 
    processOrder, 
    getReceipt, 
    getAboutPage,
    getRegisterPage,
    handleRegister,
    getLoginPage,
    handleLogin,
    confirmOrder,
    handleLogout,
    getAdminDashboard,
    getAdminProducts,
    getAdminProductAdd,
    handleAdminProductAdd,
    getAdminProductEdit,
    handleAdminProductEdit,
    handleAdminProductDelete
} = require('../controllers/serviceController');

// Middleware untuk memproteksi halaman pelanggan (Wajib login untuk transaksi)
const isUser = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
};

// Middleware untuk memproteksi halaman manajemen admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.redirect('/auth/login');
};

// --- ROUTE USER / UMUM ---
router.get('/', getAllServices);
router.post('/beli', isUser, processOrder);        // Menuju halaman review opsi bayar (beli.ejs)
router.post('/beli/proses', isUser, confirmOrder); // Aksi eksekusi pengurangan data di SQLite
router.get('/struk', isUser, getReceipt);
router.get('/tentang', getAboutPage);

// --- ROUTE AUTHENTICATION ---
router.get('/auth/register', getRegisterPage);
router.post('/auth/register', handleRegister);
router.get('/auth/login', getLoginPage);
router.post('/auth/login', handleLogin);
router.get('/auth/logout', handleLogout);

// --- ROUTE ADMIN PANEL ---
router.get('/admin/dashboard', isAdmin, getAdminDashboard);
router.get('/admin/products', isAdmin, getAdminProducts);
router.get('/admin/products/add', isAdmin, getAdminProductAdd);
router.post('/admin/products/add', isAdmin, handleAdminProductAdd);
router.get('/admin/products/edit/:id', isAdmin, getAdminProductEdit);
router.post('/admin/products/edit/:id', isAdmin, handleAdminProductEdit);
router.get('/admin/products/delete/:id', isAdmin, handleAdminProductDelete);

module.exports = router;