const express = require("express");
const cors = require("cors");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 VAPID keys desde variables de entorno
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

// Guardamos suscripciones en memoria (por dueño)
const subscriptionsByOwner = {
  Marcelo: new Map(),
  Eli: new Map()
};

// 👉 POST /subscribe  (registrar dispositivo)
app.post("/subscribe", (req, res) => {
  try {
    const { owner, subscription } = req.body || {};
    if (!owner || !subscription || !subscriptionsByOwner[owner]) {
      return res.status(400).json({ error: "Datos inválidos (owner/subscription)" });
    }

    // usamos el endpoint como llave
    subscriptionsByOwner[owner].set(subscription.endpoint, subscription);
    console.log(`✅ Guardada suscripción para: ${owner}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error en /subscribe:", err);
    res.status(500).json({ error: "Error interno en subscribe" });
  }
});

// 👉 POST /notify  (enviar notificación a uno o ambos)
app.post("/notify", async (req, res) => {
  try {
    const { title, body, targets } = req.body || {};

    if (!title || !body || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: "Datos inválidos (title/body/targets)" });
    }

    // Juntamos subs de los targets (Marcelo/Eli)
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

    console.log("Resultados push:", results.map(r => r.status));
    res.json({ ok: true, sent: subsSet.size });
  } catch (err) {
    console.error("Error en /notify:", err);
    res.status(500).json({ error: "Error interno en notify" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Agenda backend escuchando en puerto", PORT);
});
