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

        //insert into user_game_data
        await client.query(`
            INSERT INTO user_game_data (user_id) VALUES ($1)
            `,[user.rows[0].id])
            
        //get roles

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

export async function verifyEmail(req:Request,res:Response){
        try {
            const {email} = req.body
            function generateCode() {
                let code: Number[] = []
                for (let i = 0; i < 5; i++) {
                    code[i] =Math.floor(Math.random() * (10)) + 1 ;
                }
                return code.join('')
                 
            }
            const otp = generateCode()
            await client.query('UPDATE users SET otp = $1 WHERE email = $2',[otp,email])

            const subject = 'VaristySteps Email verification code'
            const message = `Your verification code is: ${otp} `
            await sendMail(email,subject,message)
            res.status(200).json({message:'action successfull'})
        } catch (error) {
            console.error()
            res.status(500).json({message:'internal server error'})
        }
    
}



let otpEmail = ''
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

            await sendMail(email,subject,message)
            res.status(200).json({message:'action successful'})
        }
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}

export async function otp(req:Request,res:Response) {
    try {
        const {otp,flag,email}=req.body
        const user_id = req.user?.id
        let unlockedAchievements = []
        
        if(flag === 'emailVerification'){
            const dbOtp = await client.query('SELECT otp FROM users WHERE email = $1',[email])
            if(Number(otp) === dbOtp.rows[0].otp){
                await client.query(`UPDATE users SET is_verified = true WHERE email = $1`,[email])
                const achievement = await client.query(`
                    SELECT a.id, ua.unlocked,a.reward,a.title,a.goal 
                    FROM achievements a
                        JOIN user_achievements ua ON ua.achievement_id = a.id
                        WHERE ua.user_id = $1 AND a.title = 'Verified Scholar';
                    `,[user_id])

                    if(!achievement.rows[0].unlocked){
                        await client.query(`
                            UPDATE user_achievements SET unlocked = true, unlocked_at = CURRENT_DATE
                             WHERE user_id = $1 AND achievement_id = $2
                            `,[user_id,achievement.rows[0].id])
        
                            await client.query(`
                                UPDATE user_game_data SET points = points + $1, achievements = achievements + 1
                                WHERE user_id = $2
                                `,[achievement.rows[0].reward,user_id])
        
                                unlockedAchievements.push({
                                    message: `You unlocked the achievement: ${achievement.rows[0].title}!`,
                                })
                            }
                            res.status(200).json(unlockedAchievements)
            }else{
                res.status(401).json({message:'incorrect otp code'})
            }
        }else if(flag==='resetPassword'){
            const dbOtp = await client.query('SELECT otp FROM users WHERE email = $1',[otpEmail])
            if(Number(otp) === dbOtp.rows[0].otp){
                res.status(200).json({message:'otp correct'})
            }else{
                res.status(401).json({message:'incorrect otp code'})
            }
        }
        
    } catch (error) {
        console.error(error)
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


export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const userId = req.user?.id;
        const { password } = req.body;
        const result = await client.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'No such user' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        // Logout the user and clear their session
        req.logout((err) => {
            if (err) {
                console.error("Logout error:", err);
                return next(err);
            }

            req.session.destroy(async (err) => {
                if (err) {
                    console.error("Session destroy error:", err);
                    return res.status(500).json({ message: 'Failed to destroy session' });
                }

                res.clearCookie('connect.sid', { path: '/' });

                // Delete the user account
                try {
                    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
                    return res.status(200).json({ message: "Account Deleted" });
                } catch (dbError) {
                    console.error("Database error:", dbError);
                    return res.status(500).json({ message: "Failed to delete account" });
                }
            });
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        next(error);
    }
}
