import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIO } from "socket.io";

import connectDB from "./app/dbConfig/dbConfig.js";
import setupRoutes from "./app/routes/index.js";
import mediasetup from "./app/routes/media.js";

dotenv.config();

const app = express();
const host = process.env.HOST || "localhost";
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://192.168.0.147:5173",
      "http://192.168.0.131:5173",
      "http://192.168.0.164:5173",
      "http://192.168.0.144:5173",
      "http://192.168.0.144:8081",
      "http://192.168.0.144:8082",
      "https://crm-cp-admin.vercel.app",
    ],
    methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"],
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

connectDB();

const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://192.168.0.147:5173",
      "http://192.168.0.131:5173",
      "http://192.168.0.164:5173",
      "http://192.168.0.144:5173",
      "http://192.168.0.144:8082",
      "http://192.168.0.144:8081",
      "https://crm-cp-admin.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("￼ New client connected:", socket.id);

  // agent room join
  socket.on("join-agent", ({ agentId }) => {
    if (!agentId) return;
    console.log(`Agent ${agentId} joined room with socket ${socket.id}`);
    socket.join(agentId); 
  });

  // admin join
  socket.on("join-admin", ({ adminId }) => {
    socket.join("admins"); 
    console.log(`Admin joined: ${adminId}`);
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

setupRoutes(app, io);
mediasetup(app);

app.get("/", (req, res) => {
  res.status(200).send({
    error: false,
    message: "Welcome to the CRM-CP-Agent Project....",
  });
});

server.listen(port, () =>
  console.log(`🚀 Server is Running at http://${host}:${port}`)
);

process.noDeprecation = true;
