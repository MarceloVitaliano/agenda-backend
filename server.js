// server.js
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// DATA EN MEMORIA (TEMPORAL)
// =========================
let tasks = [];          // { id, title, owner, date, done }
let subscriptions = [];  // { owner, subscription }

// =========================
// VAPID (WEB PUSH)
// =========================
// Idealmente pon estas claves en variables de entorno en Render:
// VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BKAvhEy5n_cgZs2_8-jzvTuR_NT5Vm5BHdZOfqSJPkdjnuGPCNmptAmGoyRiWAj-t3TXpcf_RCW_hhLPfTUadSs";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "PON_AQUI_TU_VAPID_PRIVATE_KEY_REAL"; // cámbialo en Render

webpush.setVapidDetails(
  'mailto:tu-correo@example.com', // puedes poner tu correo real
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// =========================
// ENDPOINT DE PRUEBA
// =========================
app.get('/', (req, res) => {
  res.send('Backend de Agenda funcionando ✅');
});

// =========================
// ENDPOINTS DE TAREAS
// =========================

// GET /tasks → devuelve todas las tareas
app.get('/tasks', (req, res) => {
  res.json({ tasks });
});

// POST /tasks → crea una nueva tarea
app.post('/tasks', (req, res) => {
  const { title, owner, date } = req.body;

  if (!title || !owner) {
    return res.status(400).json({ error: 'Faltan campos (title u owner)' });
  }

  const nuevaTarea = {
    id: Date.now().toString(), // id sencillo
    title,
    owner,                     // "Marcelo" | "Eli" | "Ambos"
    date: date || null,        // string tipo "2025-12-03" o null
    done: false
  };

  tasks.push(nuevaTarea);
  res.status(201).json(nuevaTarea);
});

// PATCH /tasks/:id → actualizar una tarea (ej. done)
app.patch('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const cambios = req.body; // por ahora solo esperamos { done: true/false }

  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  tasks[idx] = { ...tasks[idx], ...cambios };
  res.json(tasks[idx]);
});

// DELETE /tasks/:id → borrar una tarea
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const existe = tasks.some(t => t.id === id);

  if (!existe) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  tasks = tasks.filter(t => t.id !== id);
  res.status(204).send();
});

// =========================
// ENDPOINTS DE NOTIFICACIONES
// =========================

// POST /subscribe → guardar suscripción de un dispositivo
// body: { owner: "Marcelo" | "Eli", subscription: {...} }
app.post('/subscribe', (req, res) => {
  const { owner, subscription } = req.body;

  if (!owner || !subscription) {
    return res.status(400).json({ error: 'Faltan owner o subscription' });
  }

  // Evitar duplicados por endpoint
  const endpoint = subscription.endpoint;
  subscriptions = subscriptions.filter(sub => sub.subscription.endpoint !== endpoint);

  subscriptions.push({ owner, subscription });

  console.log(`Nueva suscripción de ${owner}`);
  res.status(201).json({ message: 'Suscripción registrada' });
});

// POST /notify → enviar notificaciones a uno o varios owners
// body: { title, body, targets: ["Marcelo"] o ["Eli"] o ["Marcelo","Eli"] }
app.post('/notify', async (req, res) => {
  const { title, body, targets } = req.body;

  if (!title || !body || !Array.isArray(targets)) {
    return res.status(400).json({ error: 'Faltan datos para notificar' });
  }

  const subsObjetivo = subscriptions.filter(sub =>
    targets.includes(sub.owner)
  );

  const payload = JSON.stringify({
    title,
    body
  });

  const resultados = [];

  await Promise.all(
    subsObjetivo.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        resultados.push({ owner: sub.owner, ok: true });
      } catch (err) {
        console.error('Error enviando notificación a', sub.owner, err);
        resultados.push({ owner: sub.owner, ok: false, error: err.message });
      }
    })
  );

  res.json({ sent: resultados });
});

// =========================
// INICIAR SERVIDOR
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor escuchando en el puerto ' + PORT);
});
