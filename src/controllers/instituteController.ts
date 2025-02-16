import { Request, Response, NextFunction } from 'express';
import { client } from '../services/connect';

export async function getInstitutions(req: Request, res: Response) {
    try {
      // Query with LIMIT and OFFSET for pagination
      const result = await client.query(`
        SELECT institutions.institution_name, institutions.institution_id, institute_type.type_name, institutions.province 
        FROM institutions
        LEFT JOIN institute_type ON institute_type.id = institutions.institute_type_id
        ORDER BY institutions.institution_name
      `);
  
      const institutions = result.rows;
  
  
      // Return paginated result
      res.status(200).json(institutions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: 'error' });
    }
  }
  
export async function searchInstitution(req:Request,res:Response) {
    const {query} = req.query
    try {
        const result = await client.query(`
            SELECT * FROM institutions
            WHERE institution_name ILIKE $1
            `,[`%${query}%`])

            res.status(200).json(result.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({msg:'error'})
    }
}
export async function institutionDetails(req:Request,res:Response) {
    const {query} = req.query
 
    const instituteName= query
    try {
        const result = await client.query(`
            SELECT * FROM institutions
            WHERE institution_name ILIKE $1
            `,[`%${instituteName}%`])


const institution_id = result.rows[0].institution_id
             const faculties = await client.query(`
                    SELECT title,faculty_link
                    FROM faculties
                    WHERE institute_id = $1
                `,[institution_id])
    
    // console.log(faculties.rows)
    const institute = result.rows[0]
    const facultyData = faculties.rows
    res.status(200).json({institute,facultyData})
    } catch (error) {
        console.error(error)
        res.status(500).json({msg:'errot'})
    }
    

} 