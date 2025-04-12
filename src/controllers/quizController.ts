import { Request, Response } from 'express';
import { client } from '../services/connect';
import { updateLBA, updateTiers } from '../utility/updateGameData';

export async function getQuiz(req:Request,res:Response) {
    try {
        const {query} = req.query
        // const quizzes = await client.query(`
        //    SELECT qu.quiz_date::TEXT,qu.id as quiz_id, qt.topic AS topic_name, qn.question_text, qn.answer_options,qn.correct_answer, qn.extra_info
        //    FROM quizzes qu
        //    JOIN quiz_topics qt ON qu.topic_id = qt.id
        //    JOIN questions qn ON qu.id = qn.quiz_id
        //    WHERE qt.topic ILIKE $1 
        //    AND qu.quiz_date = CURRENT_DATE
        //    ORDER BY qu.quiz_date DESC;
        //     `,[`%${query}%`])

            const quizzes = await client.query(`
            SELECT qu.* as quiz_id, qt.topic AS topic_name
            FROM quizzes qu
            JOIN quiz_topics qt ON qu.topic_id = qt.id
            WHERE qt.topic ILIKE $1
                `,[`%${query}%`])
        res.status(200).json(quizzes.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({'message':'server error'})
    }
}

export async function getQuestions(req:Request,res:Response) {
    try {
        const {query} = req.query
       
        const questions = await client.query(`
            SELECT  id,question_text, answer_options,correct_answer, extra_info,image
            FROM questions
           WHERE quiz_id= $1
            `,[query])
            res.status(200).json(questions.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}
//function to update has played
export async function hasPlayed(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const {quiz_id} = req.body
            const user_id = req.user?.id
            const result = await client.query(`
                SELECT * FROM user_quiz_data WHERE user_id = $1 AND quiz_id = $2
                `,[user_id,quiz_id])
                if(result.rows.length>0){
                    res.status(200).json({message:'played'})
                }else{
                await client.query(`
                INSERT INTO user_quiz_data(user_id,quiz_id, is_played) VALUES 
                ($1,$2,$3)
                `,[user_id,quiz_id,true])      
                    res.status(200).json({message:'status updated'})
                }
           
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
    }else{
        console.log('not authenticated');  
    }
}

export async function addPoints(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id = req.user?.id
        const {points,percentage}=req.body
        try {
            let unlockedAchievements = []
          const userPoints = await client.query(`
                UPDATE user_game_data SET points = points + $1, completed_quizzes = completed_quizzes +1
                WHERE user_id = $2
               RETURNING user_game_data.points, user_game_data.completed_quizzes`,[points,user_id])   
            const completedQuizzes = Number(userPoints.rows[0].completed_quizzes);
        
            // Fetch all possible quiz-related achievements at once
            const achievementsQuery = await client.query(`
                SELECT a.id, a.goal, ua.unlocked,a.title,a.reward
                FROM achievements a
                JOIN user_achievements ua ON ua.achievement_id = a.id
                WHERE ua.user_id = $1 AND a.type = 'quiz'
            `, [user_id]);
        
            const achievements = achievementsQuery.rows;
        
            // Check for achievements that should be unlocked
            for (const achievement of achievements) {
                if (!achievement.unlocked && completedQuizzes >= achievement.goal) {
                    await client.query(`
                        UPDATE user_achievements 
                        SET unlocked = true, unlocked_at = CURRENT_DATE
                        WHERE achievement_id = $1 AND user_id = $2
                    `, [achievement.id, user_id]);
                  
                    
                    await client.query(`
                        UPDATE user_game_data SET points = points + $1, achievements = achievements + 1
                        WHERE user_id = $2
                        `,[achievement.reward,user_id])

                    unlockedAchievements.push({
                            message: `You unlocked the achievement: ${achievement.title}!`,
                        })
                }                
            }
       
        const totalPoints = userPoints.rows[0].points
          const LA = await updateLBA(user_id) // leaderboard achievements  
          const TA=  await updateTiers(user_id,totalPoints)
        if(LA){
            unlockedAchievements.push(...LA)
        }
        if(TA){
            unlockedAchievements.push(...TA)
        }
                
                res.status(200).json(unlockedAchievements)
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
    }
}

export async function getRandomQuiz(req:Request,res:Response) {
    try {
        const {query} = req.query
        let topic 
        if(query == "any"){
            topic=''
        }else{
            topic=query
        }
        const quizzes = await client.query(`
           SELECT qu.quiz_date::TEXT, qu.id AS quiz_id, qt.topic AS topic_name, 
           qn.question_text, qn.answer_options, qn.correct_answer, qn.extra_info
           FROM quizzes qu
           JOIN quiz_topics qt ON qu.topic_id = qt.id
           JOIN questions qn ON qu.id = qn.quiz_id
           WHERE ($1 ='' OR qt.topic ILIKE $1)
           ORDER BY RANDOM() 
           LIMIT 10;
            `,[`%${topic}%`])
            res.status(200).json(quizzes.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'internal server error'})
    }
}