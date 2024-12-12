import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { client } from '../services/connect';
import passport from 'passport';
import { sendMail } from '../services/mail';

export async function registerUser(req: Request, res: Response, next: NextFunction) {
    const { username, email, password,role } = req.body;
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
    passport.authenticate('local',(err:any,user:any,info:any)=>{ // using passport for local authentication
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
       //query to get user role to be sent to front-end
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

export async function verifyEmailLink(req:Request,res:Response){
  
        try {
            
            const {email} = req.body
            console.log(email);
            const user_id = req.user?.id
            const subject = 'Email verification link'
            const sender = 'varsitysteps@gmail.com'
            const link = `http://localhost:3000/auth/verify/${user_id}`
            const message = `Click the following link to verify your email for your VarsitySteps account: ${link} `
            sendMail(email,subject,sender,message,res)
        } catch (error) {
            console.error()
            res.status(500).json({message:'internal server error'})
        }
    
}

let otpEmail = ''
// let otpCode =''
export async function resetPassword(req:Request,res:Response){
    try {
        const {email} = req.body
        otpEmail = email
        const emailExists = await client.query(`
            SELECT * FROM users WHERE email = $1
            `,[email])
            
        if(emailExists.rowCount===0){
            res.status(404).json({message:'oops! No such Email in the system'})
        }else if(emailExists.rowCount!=0){
            function generateCode() {
                let code: Number[] = []
                for (let i = 0; i < 5; i++) {
                    code[i] =Math.floor(Math.random() * (10)) + 1 ;
                }
                return code.join('')
                 
            }
            const otpCode = generateCode()
            await client.query('UPDATE users SET otp = $1 WHERE email = $2',[otpCode,email])
            const subject = 'Password reset request for VarsitySteps account'
            const message = `We have received a request to reset your VarsitySteps password.\n
            Use this code: ${otpCode} to proceed to the next step and reset your password.\n
            If you did not request this, you can ignore this email.
            `
            const sender = 'varsitysteps@gmail.com'
            sendMail(email,subject,sender,message,res)
           console.log(otpCode);
           
           
        }
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}
export async function otp(req:Request,res:Response) {
    try {
        const {otp}=req.body
        const dbOtp = await client.query('SELECT otp FROM users WHERE email = $1',[otpEmail])
        
        if(Number(otp) === dbOtp.rows[0].otp){
            res.status(200).json({message:'otp correct'})
        }else{
            res.status(401).json({message:'incorrect otp code'})
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({message:'Internal server error'})
    }
}
export async function newPassword (req:Request,res:Response){
    try {
        const {password}= req.body
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query(`UPDATE users SET password = $1 WHERE email = $2`,[hashedPassword,otpEmail])
        res.status(200).json({message:'everything okay'})
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Internal server error'})
    }
}