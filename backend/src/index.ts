import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { donorsRouter } from "./routes/donors.js";
import { notificationsRouter } from "./routes/notifications.js";
import { requestsRouter } from "./routes/requests.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.status(200).send("Blood donor API server is running.");
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/donors", donorsRouter);
app.use("/notifications", notificationsRouter);
app.use("/requests", requestsRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
