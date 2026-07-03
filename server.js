const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const serviceRoutes = require('./routes/serviceRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pembaca data input form post & JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfigurasi Session (Pengganti session_start() di PHP)
app.use(session({
    secret: 'cleanhouse-secret-key-123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Aktif selama 1 hari
}));

// Gunakan routing utama
app.use('/', serviceRoutes);

app.listen(PORT, () => {
    console.log(`CleanHouse Engine running on http://localhost:${PORT}`);
});