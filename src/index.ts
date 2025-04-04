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
import quizRoute from './routes/quizRoutes'
import gamesRoute from './routes/gamesRoutes'
import payRoutes from './routes/payRoutes'
import feedbackRoute from './routes/feedbackRoute'
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import PgSession from 'connect-pg-simple'
import { Pool } from 'pg';
import http from 'http';
import './middleware/passport'; 
import { initializeSocket } from './services/socket';
import 'dotenv/config'

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
  origin: 'https://www.varsitysteps.co.zw',
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
        secure: true,
        maxAge: 90 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'none'
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
app.use('/quiz',quizRoute)
app.use('/gamedata',gamesRoute)
app.use('/pay',payRoutes)
app.use('/feedback',feedbackRoute)

server.listen(3000, '0.0.0.0', () => {
  console.log(`Server running at  ${port}`);
});

 