import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { client } from '../services/connect';
import passport from 'passport';

export async function registerUser(req: Request, res: Response, next: NextFunction) {
    const { username, email, password,role } = req.body;
    console.log('sign up api hit', role)
    try {
        const existingUser =  await client.query('SELECT * FROM users WHERE email = $1',[email]);
        if (existingUser.rows.length > 0) {
          return res.status(400).json({ message: 'Account with email already exists.' });
      }
        const hashedPassword = await bcrypt.hash(password, 10);
        //creating a new user
        const user = await client.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *', [username, email, hashedPassword]);

        //get roles
        //creating a new student

        if(role==='student'){
             const getRole = await client.query('SELECT id FROM roles WHERE role_name = $1',[role])

            await client.query('INSERT INTO students (user_id) VALUES ($1)',[user.rows[0].id])
           await client.query('INSERT INTO user_roles (user_id,role_id) VALUES ($1, $2)',[user.rows[0].id,getRole.rows[0].id])
         }else if (role === 'tutor'){
            const getRole = await client.query('SELECT id FROM roles WHERE role_name = $1',[role])
           await client.query('INSERT INTO tutors (user_id) VALUES ($1)',[user.rows[0].id])
           await client.query('INSERT INTO user_roles (user_id,role_id) VALUES ($1, $2)',[user.rows[0].id,getRole.rows[0].id])
         }
         const userrole = await client.query(`
            SELECT roles.role_name
            FROM users
            JOIN user_roles ON users.id = user_roles.user_id
            JOIN roles ON user_roles.role_id = roles.id
            WHERE users.id = $1`,[user.rows[0].id])

            const roles = userrole.rows.map(row=>row.role_name)
         req.logIn(user.rows[0],(err)=>{
            if(err){
                return next(err)
            }
            return res.status(200).json(roles)
         })
    } catch (err) {
        console.error(err)
        next(err);
    }
}
 
export function loginUser(req:Request,res:Response,next:NextFunction){
    passport.authenticate('local',(err:any,user:any,info:any)=>{
        if (err) {
             return next(err);
           }
        if (!user) {
          console.log('user not found')
            return res.status(401).json({ success: false, message: info?.message || 'Login failed' });
        }   
        req.logIn(user,async()=>{
        if (err) {
           return next(err);
       }
       if(!user){
        return res.status(401).json({isAuthenticated: false, message: info?.message || 'Login failed' });
       }
       const userrole = await client.query(`
        SELECT roles.role_name
        FROM users
        JOIN user_roles ON users.id = user_roles.user_id
        JOIN roles ON user_roles.role_id = roles.id
        WHERE users.id = $1`,[user.id])

        const roles = userrole.rows.map(row=>row.role_name)
            return res.status(200).json(roles);
        })
       
    })(req,res,next)
}

export function logoutUser(req: Request, res: Response, next: NextFunction) {
    req.logout((err) => {
        if (err) { return next(err); }

        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to destroy session' });
            }

            // Clear the cookie
            res.clearCookie('connect.sid', { path: '/' });
            return res.json({ message: 'Logged out successfully' });
        });
    });
}
