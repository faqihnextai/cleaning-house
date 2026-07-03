const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function createSuperAdmin() {
    console.log('Membuka database...');
    
    // Koneksi ke file database lokal
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Data admin yang ingin dibuat
    const name = 'Admin Super';
    const email = 'superadmin@mail.com';
    const password = 'admin123'; // Password polos sesuai kebutuhanmu
    const role = 'admin';

    try {
        // 1. Pastikan tabel users sudah ada (jaga-jaga jika database belum terinisiasi)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            )
        `);

        // 2. Cek apakah email admin sudah terdaftar
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);

        if (existingUser) {
            console.log(`❌ Gagal: Email ${email} sudah terdaftar sebelumnya!`);
        } else {
            // 3. Masukkan data admin ke database
            await db.run(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, password, role]
            );
            
            console.log('\n==========================================');
            console.log('✅ User Admin Berhasil Dibuat via Script!');
            console.log(`📧 Email    : ${email}`);
            console.log(`🔑 Password : ${password}`);
            console.log(`🛡️ Role     : ${role}`);
            console.log('==========================================\n');
        }

    } catch (error) {
        console.error('❌ Terjadi kesalahan saat membuat admin:', error.message);
    } finally {
        // Tutup koneksi database setelah selesai
        await db.close();
        console.log('Koneksi database ditutup.');
    }
}

// Jalankan fungsi
createSuperAdmin();