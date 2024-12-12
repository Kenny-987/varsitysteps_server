import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import {client} from '../services/connect';



passport.use('local',new LocalStrategy({usernameField:'email',passReqToCallback:true},
    async(req,email,password,done)=>{
       console.log('2- hit verify callback')
    try {
        const res = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);
             const user = res.rows[0];

        if (!user) {
            return done(null, false, { message: 'Incorrect email.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
        }
))

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});


passport.deserializeUser(async (id: number, done) => {
    try {
        const res = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);     
        const user = res.rows[0];
        done(null, user);
    } catch (err) {
        done(err);
    }
});

 