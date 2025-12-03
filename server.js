const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 🔴 Aquí guardaremos los pendientes por mientras (en memoria)
let pendientes = [];

// Probar que el backend vive
app.get('/', (req, res) => {
  res.send('Backend de Agenda funcionando ✅');
});

// Obtener todos los pendientes
app.get('/pendientes', (req, res) => {
  res.json(pendientes);
});

// Crear un nuevo pendiente
app.post('/pendientes', (req, res) => {
  const { descripcion, deQuien, fechaLimite, creadoPor } = req.body;

  if (!descripcion || !deQuien || !creadoPor) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  const nuevo = {
    id: Date.now().toString(), // id sencillo
    descripcion,
    deQuien,
    fechaLimite: fechaLimite || null,
    creadoPor,
    creadoEn: new Date().toISOString(),
    completado: false
  };

  pendientes.push(nuevo);
  res.status(201).json(nuevo);
});

// Marcar como completado o editar algo
app.patch('/pendientes/:id', (req, res) => {
  const { id } = req.params;
  const cambios = req.body;

  const idx = pendientes.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

  pendientes[idx] = { ...pendientes[idx], ...cambios };
  res.json(pendientes[idx]);
});

// Borrar pendiente
app.delete('/pendientes/:id', (req, res) => {
  const { id } = req.params;
  pendientes = pendientes.filter(p => p.id !== id);
  res.status(204).send();
});

// Puerto para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor escuchando en el puerto ' + PORT);
});
