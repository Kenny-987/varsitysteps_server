import express from 'express';
import bodyParser from 'body-parser';
import {connectToDatabase} from './services/connect'
import authRoute from "./routes/authRoutes"
import userRoute from "./routes/userRoutes"
import tutorsRoute from './routes/tutorsRoutes'
import requestRoute from './routes/requestRoutes'
import instituteRoute from './routes/instituteRoutes'
import messagesRoute from './routes/messagesRoute'
import postsRoute from './routes/postsRoute'
import careersRoute from './routes/careersRoute'
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import PgSession from 'connect-pg-simple'
import { Pool } from 'pg';
import http from 'http';
import './middleware/passport'; 
import { initializeSocket } from './controllers/messagesController';
import 'dotenv/config'
import {job} from './services/cron'

//job.start()
const pool = new Pool({
  user: process.env.productionUser,
  host: process.env.productionHost,
  database: process.env.database,
  password: process.env.productionPassword,
  port: Number(process.env.productionPort),
  ssl: {
    rejectUnauthorized: false,
  }
});

const app = express();
const server = http.createServer(app); 
initializeSocket(server) 
const port = process.env.PORT || 3000;
connectToDatabase(); 

const PgSessionStore = PgSession(session); 
const sessionStore = new PgSessionStore({
  pool: pool, 
  tableName: 'session', 
});


app.use(bodyParser.json({ limit: '100mb' }));
const corsOptions = {
  origin: ['http://localhost:3001','http://localhost:5173'],
  credentials: true, 
   methods: ['GET', 'POST', 'OPTIONS','PATCH','PUT','DELETE'],
};

app.use(cors(corsOptions))
app.use(
    session({
      secret: process.env.secret as string, 
      resave: false,
      saveUninitialized: false,
      store:sessionStore,
      unset:'destroy',
      proxy: true,
      cookie: {
        path: '/', 
        secure: false,
        maxAge: 90 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
      }
    })
  );
  
  app.use(passport.initialize());
  app.use(passport.session());

app.use("/auth",authRoute)
app.use('/user',userRoute)
app.use('/tutors',tutorsRoute)
app.use('/api',requestRoute)
app.use('/institutes',instituteRoute)
app.use('/messages',messagesRoute)
app.use('/posts',postsRoute)
app.use('/careers',careersRoute)

server.listen(port, () => {
    console.log(`Server running at ${port}`);
});
 

  