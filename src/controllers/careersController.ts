import { Request, Response } from 'express';
import {client} from '../services/connect'

export async function getIndustries(req:Request,res:Response) {
    try {
        const industries = await client.query(
            `SELECT * from industries`
        )
        res.status(200).json(industries.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}
export async function getCareersList(req:Request,res:Response) {
    const {industry_id} = req.params
    try {
        const result = await client.query(`
            SELECT career_title,career_id FROM careers 
            WHERE industry_id = $1
            `,[industry_id])
            res.status(200).json(result.rows)
    } catch (error) {
        console.error(error)
        res.status(200).json({message:'internal server error'})
    }
} 
export async function getCareers(req:Request,res:Response) {
    try {
        const careers = await client.query(`SELECT * FROM careers`)
            res.status(200).json(careers.rows)
    } catch (error) {
        res.status(500).json({message:'internal server error'})
    }
}

export async function insertCareer(req:Request,res:Response){

    try {
        const {title,id,qualifications,skills,tasks,description,workPlaces,extraInfo} = req.body
        await client.query(`
            INSERT INTO careers(career_title, description,tasks,skills,employment_places,qualifications,extra_info,industry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            `,[title,description,tasks,skills,workPlaces,qualifications,extraInfo,id])
            
        res.status(200).json('ok')
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal sever error'})
    }

}