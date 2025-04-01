import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';
import cron from 'node-cron'
import {deleteImage} from '../services/awsconfig'
import { getSocketInstance,onlineUsers } from '../services/socket';
import { sendMail } from '../services/mail';


//function to get all tutors
export async function getTutors(req: Request, res: Response) {
    try {
        const result = await client.query(`SELECT users.id,email,username,phone,location,bio,profile_image,is_premium,tutors.*,
            COALESCE(AVG(tutor_rating.rating), 0) AS average_rating,
            COUNT(tutor_rating.rating) AS total_ratings
            FROM users 
            JOIN user_roles ON users.id = user_roles.user_id
            JOIN roles ON user_roles.role_id = roles.id
            LEFT JOIN tutors ON users.id = tutors.user_id
            LEFT JOIN tutor_rating ON tutors.user_id = tutor_rating.tutor_id
            WHERE roles.role_name = 'tutor' AND is_premium = 'true'
            GROUP BY users.id, tutors.user_id`)
        const tutors =  result.rows
        if(tutors.length == 0){
            return res.status(404).json({message:'no tutors found'})
        }
        res.status(200).json({tutors})
    } catch (error) {
        console.error(error)
        return res.status(500).json({message:'internal server error'})
    } 
}

//function to get tutor by subject
export async function getTutorsBySubject(req: Request, res: Response) {
    const {query} = req.query
    try {
        const result = await client.query(`
            SELECT id,email,username,phone,location,profile_image,bio,is_premium,tutors.*,
            COALESCE(AVG(tutor_rating.rating), 0) AS average_rating,
            COUNT(tutor_rating.rating) AS total_ratings
            FROM users 
            LEFT JOIN tutors ON users.id = tutors.user_id
            LEFT JOIN tutor_rating ON tutors.user_id = tutor_rating.tutor_id
            WHERE EXISTS (
                SELECT 1
                FROM unnest(teaches) AS subject
                WHERE subject ILIKE $1
                )
            GROUP BY users.id, tutors.user_id
            ORDER BY is_premium DESC, average_rating DESC
            `,[`%${query}%`])

            res.status(200).json(result.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({msg:'error'})
    }
}

export async function tutorProfile(req: Request, res: Response, next: NextFunction) {
    const tutorId = req.params.id
    try {
        const result = await client.query(`SELECT 
        users.id, users.email, users.username, users.phone, users.location, users.profile_image, users.bio,is_premium,tutors.*,
        (SELECT COUNT(*) FROM connections WHERE tutor_id = $1 AND status = 'connected') AS student_count,
        (SELECT COUNT(*) FROM tutor_rating WHERE tutor_id = $1) AS total_ratings,
        (SELECT AVG(rating) FROM tutor_rating WHERE tutor_id = $1) AS average_rating
    FROM users 
    LEFT JOIN tutors ON users.id = tutors.user_id
    WHERE tutors.user_id = $1`,[tutorId])
        const tutor =  result.rows[0]

        if(tutor.length === 0){
            return res.status(404).json({message:'no tutor found'})
        }
        res.status(200).json(tutor)
    } catch (error) {
        console.error(error)
        return res.status(500).json({message:'internal server error'})
    }
}

export async function rateTutor(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const {rateScore,tutor_id,rater_id} = req.body
            await client.query(`INSERT INTO tutor_rating (tutor_id,rater_id,rating) VALUES($1,$2,$3)`,[tutor_id,rater_id,rateScore])
            const newRating = await client.query(`SELECT tutor_id,
            COUNT(*) AS total_ratings,
            AVG(rating) AS average_rating
            FROM tutor_rating
            WHERE tutor_id = $1  
            GROUP BY  tutor_id`,[tutor_id])
            res.status(200).json({msg:'okay'}) 
        } catch (error) {
            console.error(error)
            res.status(500).json({msg:'error'})
        }
        
    }else{
        res.status(401).json({msg:'please login'})
    }
}

//function to check if user has rated
export async function hasRated(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id = req.user?.id
        const {tutor_id} = req.params
        try {
            let hasRated= false
            const result = await client.query(`
                SELECT rating
                FROM tutor_rating
                WHERE rater_id = $1 AND tutor_id = $2;
                `,[user_id,tutor_id])
            
            if(result.rows.length > 0){
                hasRated = true
                res.status(200).json(hasRated)
            }else{
                res.status(200).json(hasRated)
            }
        } catch (error) {
            console.error(error)
            res.status(500).json({mgs:'error'})
        }
    }
}

//function to change user premium status after it has expired
async function removePremium() {
    try {
        const query = `
      UPDATE users
      SET is_premium = FALSE
      WHERE premium_expires < NOW() AND is_premium = TRUE;
    `;
    const result = await client.query(query);
    console.log(`Updated ${result.rowCount} users to non-premium.`);
    } catch (error) {
        console.error(error)
    }
}

cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled job to remove expired premiums...');
    removePremium();
  });
  

//function to get files
// export async function getUploadedFiles(req:Request,res:Response) {
//     if(req.isAuthenticated()){
//         try {
//             const user_id =req.user.id
//         const files = await client.query(
//             `SELECT * FROM files WHERE uploader_id = $1
//             ORDER BY uploaded_at DESC`
//         ,[user_id])
//         res.status(200).json(files.rows)
//         } catch (error) {
//             console.error(error)
//             res.status(500).json({message:'Internal server error'})
//         }
        
//     }
// }
//Funtion to upload files
export async function uploadTutoringFiles(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const {file_type,student_id,class_id,tutor_id,format} = req.body   
        const files = req.files as any
        const user_id = req.user.id        
        
        const io = getSocketInstance()
        
        let receiver_id
        if(student_id==null ||!student_id || student_id=='null'){
            receiver_id = tutor_id
        }else if (student_id){     
            receiver_id = student_id
        }
        
        
        const validStudentId = Number.isInteger(Number(student_id)) ? Number(student_id) : null;
        const validClassId = Number.isInteger(Number(class_id)) ? Number(class_id) : null;
        const validTutorId = Number.isInteger(Number(tutor_id)) ? Number(tutor_id) : null;

        if(files){
            await Promise.all(files.map(async (file: any) => {
                await client.query(
                    `INSERT INTO files (uploader_id, student_id, class_id, filename, file_url, file_type, size, mimetype,tutor_id) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)`,
                    [user_id, validStudentId, validClassId, file.originalname, file.location, file_type, file.size, file.mimetype,validTutorId,format]
                );
            }));
          }
          const uploaderName = await client.query(`SELECT username FROM users WHERE id = $1`,[user_id])
          
          let mailList:any
          if(class_id && class_id != "undefined"){
            const tutor_id = await client.query(`
                SELECT tutor_id FROM classes WHERE class_id = $1
                `,[class_id])
            if(tutor_id.rows[0]==user_id){
                const students = await client.query(`
                    SELECT u.email,u.id
                    FROM users u
                    JOIN class_students c ON u.id = c.student_id
                    WHERE c.class_id = $1`,[class_id])   
                    mailList = students.rows
            }          
          }else if(receiver_id){
              const student = await client.query(`SELECT email,id FROM users WHERE id=$1`,[receiver_id])
              mailList = student.rows
          }
    
            const subject = `New VarsitySteps File Submission`
            const message = `${uploaderName.rows[0].username}. Uploaded a new file on VarsitySteps.\n
            Visit your eTutoring dashboard to view files: https://varsitysteps.co.zw/etutoring`

            const ids = mailList.map((item:any) => item.id) 
            
            ids.forEach((id:any)=>{
                        const receiverSocketId = onlineUsers[id]
                        if (receiverSocketId) {
                            io.to(receiverSocketId).emit("notification", {
                                message: `${uploaderName.rows[0].username} uploaded a new file`,
                            })
                        }
                    })

            const emails = mailList.map((mail:any)=>mail.email)
        
            
            if(emails){
                try {
                    mailList.forEach
                    await sendMail(emails, subject, message);
                } catch (emailError) {
                    console.error("Error sending email:", emailError);
                    return res.status(200).json({ message: "Response, but email notification failed" });
                }
            }
           
       
          
          const UpdatedFiles = await client.query(`
            SELECT * FROM files 
            WHERE uploader_id = $1
            ORDER BY uploaded_at DESC 
            `,[user_id])
            res.status(200).json(UpdatedFiles.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
        

    } 
}

export async function deleteTutoringFile(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const file_id = req.params.id  
        try {
            const fileUrl =await client.query(`
            SELECT file_url FROM files WHERE id =$1`,[file_id])     
            if(fileUrl){
                const isDeleted = await deleteImage(fileUrl.rows[0].file_url)
                if(isDeleted==1){
                    await client.query(`DELETE FROM files WHERE id = $1`,[file_id])
                    res.status(200).json({message:'file deleted'})
                }
                else{
                    res.status(500).json({message:"Internal server error"})
                    
                }
            }
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal server error"})
        }
    }
}

//get uploaded files from tutor
export async function getSharedFiles(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const {uploader_id,tutor_id,student_id,class_id} = req.query
            console.log("class ID: ",class_id);
           
            
            
            let files
            if(class_id!=='undefined'){
                files = await client.query(
                    `SELECT * FROM files 
                    WHERE class_id = $1`,[class_id]
                )
            }else{
                files = await client.query(
                    `SELECT * FROM files 
                    WHERE uploader_id = $1 AND (student_id = $2 or tutor_id = $3)`,[uploader_id,student_id,tutor_id]
                )
            }
            res.status(200).json(files.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal server error"})
        }
    }
}

export async function createClass(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const {classname,description}=req.body
        const user_id = req.user.id
        try {
            const createdClass = await client.query(`
                INSERT INTO CLASSES (tutor_id,name,description)
                VALUES ($1,$2,$3)
                RETURNING *
                `,[user_id,classname,description])
                let chatId
                if(createdClass){
                    const newChat = await client.query(
                        `INSERT INTO chats (name,is_group,class_id)
                         VALUES ($1,true,$2)
                         RETURNING id`
                      ,[classname,createdClass.rows[0].id]);
                      chatId = newChat.rows[0].id;
                    }
                    await client.query(
                        `INSERT INTO participants (chat_id, user_id)
                         VALUES ($1, $2)`,
                        [chatId, user_id]
                      );
            res.status(200).json(createdClass.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal server error"})
        }
    }
}

export async function getClasses(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id = req.user.id
        
        try {
            const classes = await client.query(`
                SELECT * FROM classes WHERE tutor_id = $1
                `,[user_id])
            res.status(200).json(classes.rows)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal server error"})
        }
    }
}

export async function getClassDetails(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const user_id = req.user.id
            const class_id = req.params.id
            const classDetails = await client.query(`
                SELECT * FROM classes WHERE id = $1
                `,[class_id])

            const classStudents = await client.query(`
                select cs.student_id, u.username, u.profile_image
                from users u
                join class_students cs on cs.student_id = u.id
                where class_id = $1
                `,[class_id]) 
                const isInClass = classStudents.rows.some(student => student.student_id === user_id);

         if(user_id == classDetails.rows[0].tutor_id || isInClass){
             res.status(200).json({classDetails:classDetails.rows,classStudents:classStudents.rows})
         }else{
            return res.sendStatus(401)
         }
            
            // const classDetails = [...classes.rows,...classStudents]
        } catch (error) {
            console.error(error)
            res.status(500).json({message:"Internal server error"})
        }
    }else{
        res.sendStatus(401)
    }
}

export async function getMyClasses(req:Request,res:Response) {
 if(req.isAuthenticated()){
    const user_id = req.user.id
    try {
        const classes = await client.query(`
            SELECT classes.*,class_students.joined_at
            FROM classes
            JOIN class_students on class_students.class_id = classes.id
            WHERE class_students.student_id = $1  
            `,[user_id])
            res.status(200).json(classes.rows)
    } catch (error) {
        console.log(error);
        res.status(500).json('error')
    }
 }   
}

export async function editClass(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const {classname,description,classid} = req.body
        
        try {
            const classDetails = await client.query(`
                UPDATE classes SET name = $1, description = $2 WHERE id = $3 RETURNING *
                `,[classname,description,classid])
                await client.query(`
                   UPDATE chats SET name =  $1 WHERE class_id = $2
                    `,[classname,classid])
            
            res.status(200).json(classDetails.rows[0])
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'server error'})
        }
    }
}
//
// export async function deleteClass(req:Request,res:Response) {
//     if(req.isAuthenticated()){
//         const {classname,description,classid} = req.body
        
//         try {
//             const classDetails = await client.query(`
//                 UPDATE classes SET name = $1, description = $2 WHERE id = $3 RETURNING *
//                 `,[classname,description,classid])
//                 await client.query(`
//                    UPDATE chats SET name =  $1 WHERE class_id = $2
//                     `,[classname,classid])
            
//             res.status(200).json(classDetails.rows[0])
//         } catch (error) {
//             console.error(error)
//             res.status(500).json({message:'server error'})
//         }
//     }
// }

export async function AddStudent(req:Request,res:Response) {
    if(req.isAuthenticated()){

        const user_id= req.user.id
        const{student_id,class_id,tutorName,className}=req.body
        const studentSocketId = onlineUsers[student_id]
        const io = getSocketInstance()
        
        try {
            await client.query(`
                INSERT INTO class_students(class_id,student_id)
                VALUES($1,$2)`,[class_id,student_id])
            
            const chat_id = await client.query(`
                SELECT id FROM chats WHERE class_id = $1
                `,[class_id])

            await client.query(`
                insert into participants (chat_id,user_id)
                VALUES ($1,$2)
                `,[chat_id.rows[0].id,student_id])
            
                const email = await client.query(`SELECT email FROM users WHERE id=$1`,[student_id])
                const subject = `VarsitySteps classes.`
                const message = `Your Tutor ${tutorName} added you to the class ${className} on VarsitySteps. \n Visit the etutoring dashboard and start learning: https://varsitysteps.co.zw/etutoring`
    
                if(email.rows.length>0){
                    try {
                        await sendMail(email.rows[0].email, subject, message);
                    } catch (emailError) {
                        console.error("Error sending email:", emailError);
                        return res.status(200).json({ message: "Request sent, but email notification failed" });
                    }
                }
                io.to(studentSocketId).emit('notification',{
                    message: `${tutorName} added you to the class: ${className}`
                })
                res.status(200).json('okay')
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'Internal Server error'})
        }

    }
}
export async function removeStudent(req:Request,res:Response) {
    if(req.isAuthenticated()){
    const user_id = req.user.id
    const {class_id,student_id}=req.query
    console.log(class_id,student_id);
    
    try {
        const tutor_id = await client.query(`
            SELECT tutor_id FROM classes WHERE id= $1
            `,[class_id])
        if(user_id == tutor_id.rows[0]){
            await client.query(`
                DELETE from class_students WHERE student_id =$1 and class_id = $2
                `,[student_id,class_id])
            await client.query(`
                DELETE FROM participants where user_id = $1
                `,[student_id])
                res.status(200).json('user gone')
        }else{
            res.status(401).json({message:'Unathorized to perform action'})
        }
        
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Interval server error'})
    }
    }
}