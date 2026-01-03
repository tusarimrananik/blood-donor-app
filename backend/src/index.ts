import "dotenv/config";
import express from "express";
import cors from "cors";
import { donorsRouter } from "./routes/donors.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/donors", donorsRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
