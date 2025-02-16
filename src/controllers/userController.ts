import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';
import {deleteImage} from '../services/awsconfig'
import bcrypt from 'bcrypt';
import { log } from 'console';


declare global{
    namespace Express{
        interface User{
            id:string
            role:string
        }
    }
}
//function to edit user details
export async function editUser(req: Request, res: Response, next: NextFunction) {
    if(req.isAuthenticated()){
        try { 
            console.log('hit edit api');
        
        const userId = req.params.userId
        const newUserData = req.body
        console.log("user ID: ",userId," user data: ",newUserData)
        
        const userUpdates:any={}
        const studentUpdates:any={}
        const tutorUpdates:any={}
        const creatorUpdates:any={}
        let user,creator
        Object.keys(newUserData).forEach((key)=>{
            if(['username','email','location','phone','bio'].includes(key)){
                userUpdates[key]= newUserData[key]
            }else if(['institution','programme'].includes(key)){
                studentUpdates[key]=newUserData[key]
            }else if(['qualifications','teaches','teaching_method','base_charge'].includes(key)){
                tutorUpdates[key]=newUserData[key]
            }else if(['field','skills','specializations'].includes(key)){
                creatorUpdates[key]=newUserData[key]
            }
        })
    
        //updating user table
        if(Object.keys(userUpdates).length > 0){
            const userQuery = {
                text: `UPDATE users SET ${Object.keys(userUpdates).map((key)=> `${key}=$${Object.keys(userUpdates).indexOf(key)+1}`).join(', ')} WHERE id = $${Object.keys(userUpdates).length +1} RETURNING *`,
                values: Object.values(userUpdates).concat(userId)
                }
                const userResult = await client.query(userQuery)
                user = userResult.rows[0]
        }
        
        
        //updating students table
        if (Object.keys(studentUpdates).length > 0){
            const studentQuery = {
                text: `UPDATE students SET ${Object.keys(studentUpdates).map((key)=>`${key} =$${Object.keys(studentUpdates).indexOf(key)+1}`).join(', ')} WHERE user_id = $${Object.keys(studentUpdates).length +1} RETURNING *`,
                values: Object.values(studentUpdates).concat(userId)
                }
                const studentResult = await client.query(studentQuery)
                user = {...user, ...studentResult.rows[0]}
                
        }
        
        //updating tutors table
        if (Object.keys(tutorUpdates).length > 0) {
            const tutorQuery = {
                text: `UPDATE tutors SET ${Object.keys(tutorUpdates).map((key) => {
                    if (key === 'qualifications' && tutorUpdates[key]) {
                        return `${key} = $${Object.keys(tutorUpdates).indexOf(key) + 1}::text[]`;
                    } else if (key === 'teaches' && tutorUpdates[key]) {
                        return `${key} = $${Object.keys(tutorUpdates).indexOf(key) + 1}::text[]`;
                    } else {
                        return `${key} = $${Object.keys(tutorUpdates).indexOf(key) + 1}`;
                    }
                }).join(', ')} WHERE user_id = $${Object.keys(tutorUpdates).length + 1} RETURNING *`,
                values: Object.values(tutorUpdates).concat(userId)
            };
            const tutorResult = await client.query(tutorQuery);
            user = { ...user, ...tutorResult.rows[0] };
        }

        //updating creatives table
         //updating students table
        if (Object.keys(creatorUpdates).length > 0){
            const creatorQuery = {
                text: `UPDATE creators SET ${Object.keys(creatorUpdates).map((key)=>`${key} =$${Object.keys(creatorUpdates).indexOf(key)+1}`).join(', ')} WHERE user_id = $${Object.keys(creatorUpdates).length +1} RETURNING *`,
                values: Object.values(creatorUpdates).concat(userId)
                }
                const creatorResult = await client.query(creatorQuery)
                creator = creatorResult.rows[0]
        }

        if(user || creator){
            res.status(200).json({user,creator})
        }else return res.status(204)
        } 
        catch (error) {
            console.error(error)
            res.status(500).json({message:'error updating'})
        } 
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
 
}

//function to edit profile picture
export async function editImage(req: Request, res: Response) {
    if(req.isAuthenticated()){
        try {
            const userId = req.body.userId;
            const file = req.file as any; 
        
            if (!file) {
              console.log('no file')
              return res.status(400).json({ message: 'No file uploaded' });
            }

            const imageUrl = file.location;
            const currentImage = await client.query(`SELECT profile_image FROM users WHERE id = $1`, [userId]);
      
            // Delete the old profile picture from S3
            if(currentImage.rowCount !== 0 ){
                const oldImageUrl = currentImage.rows[0].profile_image;
                if (oldImageUrl) {
                  await deleteImage(oldImageUrl);
                }
            }
        
            const response = await client.query(`UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING *`, [imageUrl, userId]);
        
            if (response.rowCount === 0) {
              return res.status(404).json({ message: 'User not found' });
            }
            const user = response.rows[0];
        
            res.status(200).json({user});
          } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Failed to edit image' });
          }
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
  }

  //function to delete profile image
export async function deleteProfileImage(req: Request, res: Response) {
    if(req.isAuthenticated()){
        try {
            const userId = req.params.userId
        const currentImage = await client.query(`SELECT profile_image FROM users WHERE id = $1`, [userId]);

        if(currentImage.rowCount !== 0 ){
              const oldImageUrl = currentImage.rows[0].profile_image;
              if (oldImageUrl) {
               const isDeleted =  await deleteImage(oldImageUrl);
               if(isDeleted ==1){
                   const response =  await client.query(`UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING *`,[null,userId])
                   const user = response.rows[0];
                   res.status(200).json({user})

               }
              }
            
          }else{
            return res.status(404).json({message:'no image to delete'})
          }

        } catch (error) {
            console.error(error)
            res.status(500).json('internal server error')
        }
        
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
}

//function to edit password
export async function editPassword(req: Request, res: Response, next: NextFunction){
    if(req.isAuthenticated()){
        const userId = req.user?.id
        const {currentPassword,newPassword} = req.body 

        const result = await client.query(`SELECT * FROM users WHERE id = $1`, [userId]);
          
             const user = result.rows[0];

        if (!user) {
            console.log('no user found')
            return res.status(404).json({msg:'No such user'})
        }
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            console.log('incorrect code')
            return res.status(401).json({message:"incorrect password"});
        }else{
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await client.query(`UPDATE users SET password = $1 WHERE id = $2`,[hashedPassword,userId])
            return res.status(200).json({message:"password updated"});
        }
        
    }else{
        return res.status(401).json({msg:"No access please login"})
    }
}


//function to get user specific data
export async function getUserInfo(req: Request, res: Response, next: NextFunction){
    if(req.isAuthenticated()){
        try {
            const userId = req.user?.id
            //check if user email is verified and add points and achievements
            const user = await client.query(`
                SELECT is_verified FROM users WHERE id = $1
                `,[userId])
            if(user.rows[0].is_verified){
                const achievement = await client.query(`
                    SELECT a.id, ua.unlocked,a.reward,a.title,a.goal 
                        FROM achievements a
                        JOIN user_achievements ua ON ua.achievement_id = a.id
                        WHERE ua.user_id = $1 AND a.title = 'Verified Scholar';
                    `,[userId])
                    if(achievement){
                    if(!achievement.rows[0].unlocked){
                        await client.query(`
                            UPDATE user_achievements SET unlocked = true, unlocked_at = CURRENT_DATE
                             WHERE user_id = $1 AND achievement_id = $2
                            `,[userId,achievement.rows[0].id])
        
                            await client.query(`
                                UPDATE user_game_data SET points = points + $1, achievements = achievements + 1
                                WHERE user_id = $2
                                `,[achievement.rows[0].reward,userId])
                            }
                        }
            }
            //get role
            const userRolesResult = await client.query(`
                SELECT roles.role_name
                FROM users
                JOIN user_roles ON users.id = user_roles.user_id
                JOIN roles ON user_roles.role_id = roles.id
                WHERE users.id = $1`,[userId])
                const userRoles = userRolesResult.rows.map(row => row.role_name);
                
                let userData = {};
                //check if role is both tutor and student
                if (userRoles.includes('tutor')&&userRoles.includes('student')) {
                    const tutorResult = await client.query(`
                        SELECT * FROM tutors
                        WHERE user_id = $1`, [userId]);
                      userData = { ...userData, tutoring: tutorResult.rows[0] };
                  }
                if (userRoles.includes('student')) {
                    const studentResult = await client.query(`
                    SELECT users.*, 
                    ARRAY_AGG(roles.role_name) AS role_name, students.*
                    FROM users
                    JOIN user_roles ON users.id = user_roles.user_id
                    JOIN roles ON user_roles.role_id = roles.id
                    LEFT JOIN students ON users.id = students.user_id
                    WHERE users.id = $1
                    GROUP BY users.id, students.user_id;`, [userId]);
            
                      userData = { ...userData, user: studentResult.rows[0] }
                    }
                    // Check if the user is also a creative
                    if (userRoles.includes('creator')) {
                      const creativeResult = await client.query(`
                        SELECT * FROM creators
                        WHERE user_id = $1`, [userId]);
                        userData = { ...userData, creative: creativeResult.rows[0] };
                    }
            
                  if (userRoles.includes('tutor')&&!userRoles.includes('student')) {
                    const tutorResult = await client.query(`
                      SELECT users.*, roles.role_name, tutors.*
                      FROM users
                      JOIN user_roles ON users.id = user_roles.user_id
                      JOIN roles ON user_roles.role_id = roles.id
                      LEFT JOIN tutors ON users.id = tutors.user_id
                      WHERE users.id = $1`, [userId]);
            
                      userData = { ...userData, user: tutorResult.rows[0] };
                  }
                  
                  res.status(200).json(userData);
        } catch (error) {
            console.error(error)
            res.status(500).json({msg:'server error'})
        }
            
    }else{
        return res.status(204).json({msg:"No access please login"})
    }
        
}

//function to get a list of students under tutor
export  async function getStudents(req: Request, res: Response) {
    if(req.isAuthenticated()){
        try {
            const user_id = req.user?.id
            const studentList = await client.query(`
                SELECT users.username,users.profile_image,students.user_id
                FROM users
                JOIN students ON users.id = students.user_id
                JOIN connections ON users.id = connections.student_id
                WHERE connections.tutor_id = $1 AND connections.status = 'connected';
                `,[user_id])
                res.status(200).json(studentList.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'error'})
        }
      

    }else{
        return res.status(204).json({msg:"No access please login"})
    }
      
}

//function to get a list of tutors connected to a student
export  async function getMyTutors(req: Request, res: Response) {
    if(req.isAuthenticated()){
        try {
            const user_id = req.user?.id
            const tutorList = await client.query(`
                SELECT users.username,users.profile_image,tutors.user_id
                FROM users
                JOIN tutors ON users.id = tutors.user_id
                JOIN connections ON users.id = connections.tutor_id
                WHERE connections.student_id = $1 AND connections.status = 'connected';
                `,[user_id])
                res.status(200).json(tutorList.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'error'})
        }
      

    }
}


//fuction to get student profile
export async function studentProfile (req: Request, res: Response){
    const studentId = req.params.id
    console.log(studentId)
    try {
        const result = await client.query(`SELECT id,username,location, profile_image,students.*
            FROM users 
            LEFT JOIN students  
            ON users.id = students.user_id
            WHERE students.user_id = $1`,[studentId]) 
            console.log(result.rows[0])
            const student =  result.rows[0]
            if(student.length < 0){
                return res.status(404).json({message:'no tutor found'})
            }
            res.status(200).json(student)
    } catch (error) {
        console.error(error)
        return res.status(500).json({message:'internal server error'})
    }

}


// function to create new creator account
export async function creacteCreator(req: Request, res: Response) {
    if(req.isAuthenticated()){
        const user_id = req.user?.id
        const {field,specializations,skills} = req.body
        // console.log(field,specializations,skills)
        try {
            await client.query(`INSERT INTO user_roles (user_id,role_id) VALUES ($1, $2)`,[user_id,3])
             await client.query(`
                INSERT INTO creators(user_id,field, specializations,skills) VALUES ($1,$2,$3,$4)
                `,[user_id,field,specializations,skills])
                res.status(200).json({msg:'creative created'})
        } catch (error) {
            console.error(error)
            res.status(500)
        }
    }else{
        return res.status(204).json({msg:"No access please login"})
    }
}

//create tutor
export async function createTutor(req: Request, res: Response) {
    if(req.isAuthenticated()){
        const user_id = req.user?.id
        const {teaches,qualifications} = req.body
        try {
            await client.query(`INSERT INTO user_roles (user_id,role_id) VALUES ($1, $2)`,[user_id,2])
             await client.query(`
                INSERT INTO tutors(user_id,qualifications,teaches) VALUES ($1,$2,$3)
                `,[user_id,qualifications,teaches])
                res.status(200).json({msg:'tutor'})
        } catch (error) {
            console.error(error)
            res.status(500)
        }
    }else{
        return res.status(204).json({msg:"No access please login"})
    }
}