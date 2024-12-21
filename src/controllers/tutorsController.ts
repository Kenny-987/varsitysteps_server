import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';


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
        (SELECT COUNT(*) FROM connections WHERE tutor_id = $1) AS student_count,
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