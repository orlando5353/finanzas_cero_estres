require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a PostgreSQL (compatible con SSL de Render y Railway)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

// Inicializar tablas y datos base automáticamente
async function initDB() {
  try {
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
      CREATE TABLE IF NOT EXISTS diagnosticos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        ingreso_mensual NUMERIC(12, 2) NOT NULL,
        necesidades NUMERIC(12, 2) NOT NULL,
        gustos NUMERIC(12, 2) NOT NULL,
        ahorro NUMERIC(12, 2) NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar producto inicial si la tabla está vacía (medios alojados en la nube)
    const { rows } = await pool.query('SELECT COUNT(*) FROM productos');
    if (parseInt(rows[0].count) === 0) {
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
    console.log('Base de datos PostgreSQL inicializada correctamente.');
  } catch (err) {
    console.error('Error al inicializar la base de datos:', err);
  }
}

// --- RUTAS DE LA API ---

// 1. Obtener el producto destacado (con enlaces de medios en la nube)
app.get('/api/producto', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// 2. Obtener historial de diagnósticos guardados en la BD
app.get('/api/diagnosticos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM diagnosticos ORDER BY fecha DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar diagnósticos' });
  }
});

// 3. Guardar un nuevo cálculo financiero en la BD
app.post('/api/diagnosticos', async (req, res) => {
  const { nombre, ingreso_mensual } = req.body;
  const ingreso = parseFloat(ingreso_mensual);

  if (!nombre || isNaN(ingreso) || ingreso <= 0) {
    return res.status(400).json({ error: 'Ingresa un nombre y un monto válido mayor a 0.' });
  }

  const necesidades = +(ingreso * 0.50).toFixed(2);
  const gustos = +(ingreso * 0.30).toFixed(2);
  const ahorro = +(ingreso * 0.20).toFixed(2);

  try {
    const result = await pool.query(
      `INSERT INTO diagnosticos (nombre, ingreso_mensual, necesidades, gustos, ahorro)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre.trim(), ingreso, necesidades, gustos, ahorro]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar en base de datos' });
  }
});

// 4. Eliminar un registro de prueba
app.delete('/api/diagnosticos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM diagnosticos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar registro' });
  }
});

// Iniciar servidor
app.listen(PORT, async () => {
  await initDB();
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});