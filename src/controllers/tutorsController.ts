import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';


//function to get all tutors
export async function getTutors(req: Request, res: Response) {
    try {
        const query = `SELECT users.id,email,username,phone,location,bio,profile_image,tutors.*
            FROM users 
            JOIN user_roles ON users.id = user_roles.user_id
            JOIN roles ON user_roles.role_id = roles.id
            LEFT JOIN tutors  
            ON users.id = tutors.user_id
            WHERE roles.role_name = 'tutor'`
        const result =  await client.query(query)
        const tutors =  result.rows
        if(tutors.length < 0){
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
    console.log(query)
    try {
        const result = await client.query(`
            SELECT id,email,username,phone,location,profile_image,bio,tutors.*
                       FROM users 
                       LEFT JOIN tutors  
                       ON users.id = tutors.user_id
            WHERE EXISTS (
            SELECT 1
            FROM unnest(teaches) AS subject
            WHERE subject ILIKE $1
            )
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
        const query = `SELECT id,email,username,phone,location,profile_image,bio,tutors.*
                        FROM users 
                        LEFT JOIN tutors  
                        ON users.id = tutors.user_id
                        WHERE tutors.user_id = $1`
        const result =  await client.query(query,[tutorId])
        const tutor =  result.rows[0]

        //getting the number of students
   
            const getStudentCount = await client.query( `
                SELECT COUNT(student_id) AS student_count
                FROM connections
                WHERE tutor_id = $1;
              `,[tutorId]);
           const studentCount =  getStudentCount.rows[0].student_count;
       

        if(tutor.length < 0){
            return res.status(404).json({message:'no tutor found'})
        }
        res.status(200).json({tutor,studentCount})
    } catch (error) {
        console.error(error)
        return res.status(500).json({message:'internal server error'})
    }
}

