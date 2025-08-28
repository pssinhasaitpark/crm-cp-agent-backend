import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser"; 
import dotenv from "dotenv";
import connectDB from "./app/dbConfig/dbConfig.js";
import setupRoutes from "./app/routes/index.js";
import mediasetup from "./app/routes/media.js"
// import morgan from 'morgan';


dotenv.config();


const app = express();
const host = process.env.HOST;
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://192.168.0.147:5173",
      "http://192.168.0.131:5173",
      "http://192.168.0.164:5173",
      "http://192.168.0.144:5173",
    ],
    methods: ["GET", "POST", "HEAD", "PUT", "PATCH", "DELETE"],
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

// app.use(morgan("dev"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); 

connectDB();
setupRoutes(app);
mediasetup(app);

app.get("/", (req, res) => {
  return res.status(200).send({
    error: false,
    message: "Welcome to the CRM-CP-Agent Project....",
  });
});

app.listen(port, () =>
  console.log(`🚀 Server is Running at http://${host}:${port}`)
);

process.noDeprecation = true;