import { Request, Response } from 'express';
import { client } from '../services/connect';
import { sendMail } from '../services/mail';

export async function feedback(req:Request,res:Response) {
    const {name,feedback}=req.body
            let feedbackName = name?name:'Anonymous contibuter'
            let feedbackEmail = 'varsitysteps@gmail.com'
            const subject = 'New feedback recieved'
            const message = `${feedback}\n from ${feedbackName}`

    if(req.isAuthenticated()){
        try {
            const user_id=req.user.id
            let unlockedAchievements=[]
            const achievement = await client.query(`
                SELECT a.id, ua.unlocked,a.reward,a.title 
                    FROM achievements a
                    JOIN user_achievements ua ON ua.achievement_id = a.id
                    WHERE ua.user_id = $1 AND a.title = 'Valued Voice';
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
           await sendMail(feedbackEmail,subject,message)
             
           if(unlockedAchievements.length>0){
            res.status(200).json(unlockedAchievements)
        }else{
            res.status(200).send()
        }
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
    }else{
        try {
            await sendMail(feedbackEmail, subject, message);
            return res.json({ message: 'Feedback received successfully, and email sent.' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}