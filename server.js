const express = require("express");
const cors = require("cors");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

// ======================================================
//  VAPID KEYS DESDE VARIABLES DE ENTORNO
// ======================================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const WEB_PUSH_EMAIL = process.env.WEB_PUSH_EMAIL || "mailto:tu-correo@example.com";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn("⚠️ Falta configurar VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Render");
}

webpush.setVapidDetails(
  WEB_PUSH_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ======================================================
//  SUSCRIPCIONES PUSH (MARCELO / ELI)
// ======================================================
const subscriptionsByOwner = {
  Marcelo: new Map(),
  Eli: new Map()
};

app.post("/subscribe", (req, res) => {
  try {
    const { owner, subscription } = req.body || {};
    if (!owner || !subscription || !subscriptionsByOwner[owner]) {
      return res.status(400).json({ error: "Datos inválidos (owner/subscription)" });
    }

    subscriptionsByOwner[owner].set(subscription.endpoint, subscription);
    console.log(`✅ Guardada suscripción para: ${owner}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error en /subscribe:", err);
    res.status(500).json({ error: "Error interno en subscribe" });
  }
});

app.post("/notify", async (req, res) => {
  try {
    const { title, body, targets } = req.body || {};

    if (!title || !body || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "Datos inválidos (title/body/targets)" });
    }

    const subsSet = new Set();
    targets.forEach((owner) => {
      const key = owner === "Eli" ? "Eli" : "Marcelo";
      const map = subscriptionsByOwner[key];
      for (const sub of map.values()) {
        subsSet.add(sub);
      }
    });

    const payload = JSON.stringify({ title, body });

    const results = await Promise.allSettled(
      Array.from(subsSet).map((sub) => webpush.sendNotification(sub, payload))
    );

    console.log("Resultados push:", results.map((r) => r.status));
    res.json({ ok: true, sent: subsSet.size });
  } catch (err) {
    console.error("Error en /notify:", err);
    res.status(500).json({ error: "Error interno en notify" });
  }
});

// ======================================================
//  TAREAS COMPARTIDAS EN MEMORIA
// ======================================================
// Nota: esto se pierde si Render reinicia el servicio.
// Para uso de ustedes 2 está bien por ahora.
// Luego se puede pasar a BD si la queremos ultra permanente.
let tasks = [];

// GET /tasks - devuelve todas las tareas
app.get("/tasks", (req, res) => {
  res.json({ tasks });
});

// POST /tasks - crea una nueva tarea
app.post("/tasks", (req, res) => {
  try {
    const { title, owner, date } = req.body || {};
    if (!title || !owner) {
      return res.status(400).json({ error: "Faltan datos (title/owner)" });
    }

    const newTask = {
      id: Date.now().toString(),
      title,
      owner,
      date: date || "",
      done: false
    };

    tasks.push(newTask);
    console.log("📝 Nueva tarea:", newTask);
    res.json(newTask);
  } catch (err) {
    console.error("Error en POST /tasks:", err);
    res.status(500).json({ error: "Error interno al crear tarea" });
  }
});

// PATCH /tasks/:id - actualizar estado done
app.patch("/tasks/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { done } = req.body || {};

    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    if (typeof done === "boolean") {
      tasks[idx].done = done;
    }

    res.json(tasks[idx]);
  } catch (err) {
    console.error("Error en PATCH /tasks/:id:", err);
    res.status(500).json({ error: "Error interno al actualizar tarea" });
  }
});

// DELETE /tasks/:id - borrar tarea
app.delete("/tasks/:id", (req, res) => {
  try {
    const { id } = req.params;
    const before = tasks.length;
    tasks = tasks.filter((t) => t.id !== id);

    if (tasks.length === before) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /tasks/:id:", err);
    res.status(500).json({ error: "Error interno al borrar tarea" });
  }
});

// ======================================================
//  INICIO DEL SERVIDOR
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Agenda backend escuchando en puerto", PORT);
});
