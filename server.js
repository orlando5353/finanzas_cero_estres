require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

async function initDB() {
  try {
    // Limpiar tabla anterior con datos financieros si existe
    await pool.query(`DROP TABLE IF EXISTS diagnosticos;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(150) NOT NULL,
        descripcion TEXT NOT NULL,
        precio VARCHAR(50) NOT NULL,
        imagen_nube_url TEXT NOT NULL,
        video_nube_url TEXT NOT NULL,
        shopify_url TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS resenas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        calificacion INT NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
        comentario TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows: prodRows } = await pool.query('SELECT COUNT(*) FROM productos');
    if (parseInt(prodRows[0].count) === 0) {
      await pool.query(
        `INSERT INTO productos (titulo, descripcion, precio, imagen_nube_url, video_nube_url, shopify_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'Plantilla Maestra: Control Financiero 50/30/20',
          'Automatiza tus ingresos, gastos fijos, deudas y metas de ahorro sin fórmulas complicadas. Acceso inmediato tras la compra.',
          '$9.99 USD',
          'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80',
          'https://www.youtube.com/embed/HQzoZfc3GwQ',
          '#proximamente-shopify'
        ]
      );
    }

    const { rows: resRows } = await pool.query('SELECT COUNT(*) FROM resenas');
    if (parseInt(resRows[0].count) === 0) {
      await pool.query(
        `INSERT INTO resenas (nombre, calificacion, comentario) VALUES 
         ('Sofía G.', 5, 'Excelente herramienta, me dio mucha claridad sobre cuánto debo ahorrar cada mes sin comprometer mi privacidad.'),
         ('Alejandro R.', 5, 'Súper rápida y clara. Ideal para dividir la quincena en segundos desde el celular.')`
      );
    }

    console.log('Base de datos PostgreSQL actualizada correctamente.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
}

// --- RUTAS DE LA API ---

app.get('/api/producto', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

app.get('/api/resenas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resenas ORDER BY fecha DESC LIMIT 12');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reseñas' });
  }
});

app.post('/api/resenas', async (req, res) => {
  const { nombre, calificacion, comentario } = req.body;
  const estrellas = parseInt(calificacion);

  if (!nombre || !comentario || isNaN(estrellas) || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ error: 'Completa tu nombre, calificación y comentario.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO resenas (nombre, calificacion, comentario)
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), estrellas, comentario.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar reseña' });
  }
});

app.listen(PORT, async () => {
  await initDB();
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});