const { createClient } = require('@libsql/client');
const path = require('path');

async function createSuperAdmin() {
    console.log('Menghubungkan ke database...');
    
    // Konfigurasi koneksi (otomatis mendeteksi ENV atau fallback ke file lokal)
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL || `file:${path.join(process.cwd(), 'database.sqlite')}`,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined
    });

    // Data admin yang ingin dibuat
    const name = 'Admin Super';
    const email = 'superadmin@mail.com';
    const password = 'admin123'; // Password polos sesuai kebutuhan
    const role = 'admin';

    try {
        // 1. Pastikan tabel users sudah ada
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        `);

        // 2. Cek apakah email admin sudah terdaftar
        const existingUserResult = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [email]
        });

        if (existingUserResult.rows.length > 0) {
            console.log(`❌ Gagal: Email ${email} sudah terdaftar sebelumnya!`);
        } else {
            // 3. Masukkan data admin ke database
            await db.execute({
                sql: 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                args: [name, email, password, role]
            });
            
            console.log('\n==========================================');
            console.log('✅ User Admin Berhasil Dibuat via Script!');
            console.log(`📧 Email    : ${email}`);
            console.log(`🔑 Password : ${password}`);
            console.log(`🛡️ Role     : ${role}`);
            console.log('==========================================\n');
        }

    } catch (error) {
        console.error('❌ Terjadi kesalahan saat membuat admin:', error.message);
    }
    // Catatan: @libsql/client mengelola koneksi pool secara internal, 
    // sehingga tidak perlu memanggil fungsi .close() secara manual.
}

// Jalankan fungsi
createSuperAdmin();