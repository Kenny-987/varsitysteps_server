import { Request, Response } from 'express';
import { client } from '../services/connect';
import { updateLBA, updateSSA, updateTiers } from '../utility/updateGameData';

//function to get user game data
export async function getData(req:Request,res:Response){
    if(req.isAuthenticated()){
        const user_id = req.user?.id
        try {
            const result = await client.query(`
            WITH user_game_data AS(
            SELECT *,
            RANK() OVER (ORDER BY points DESC) as position 
            FROM user_game_data)
            SELECT *
            FROM user_game_data
            WHERE user_id = $1
            `,[user_id])
            const userPoints = result.rows[0].points
            
            let tier_progress 
            let tier_goal
            let points_left
            if(userPoints<50){
                tier_progress = ((result.rows[0].points / 50) * 100).toFixed(0)
                points_left=`Earn ${50 - userPoints} more points to reach Beginner`

            }else if(userPoints >= 50 && userPoints< 250){
                tier_progress = ((result.rows[0].points / 250) * 100).toFixed(0)
                points_left=`Earn ${250 - userPoints} more points to reach Explorer`

            }else if(userPoints >= 250 && userPoints < 750){
                tier_progress = ((result.rows[0].points / 750) * 100).toFixed(0)
                points_left=`Earn ${750 - userPoints} more points to reach Scholar`
                
            }else if(userPoints >= 750 && userPoints < 1500){
                tier_progress = ((result.rows[0].points / 1500) * 100).toFixed(0)
                points_left=`Earn ${1500 - userPoints} more points to reach Mastermind`
                
            }else if(userPoints >= 1500 && userPoints < 3000){
                tier_progress = ((result.rows[0].points / 3000) * 100).toFixed(0)
                points_left=`Earn ${3000 - userPoints} more points to reach Elite Thinker`

            }else if(userPoints >= 3000 && userPoints < 5000){
                tier_progress = ((result.rows[0].points / 5000) * 100).toFixed(0)
                points_left=`Earn ${5000 - userPoints} more points to reach Grandmaster`

            }else if(userPoints >= 5000 && userPoints < 10000){
                tier_progress = ((result.rows[0].points / 10000) * 100).toFixed(0)
                points_left=`Earn ${10000 - userPoints} more points to reach Legend`
            }else{
                tier_progress = 100
                tier_goal = 'Legendary status achieved'
            }
        let unlockedAchievements:object[] = []
          const LA = await updateLBA(user_id)  //leaderboard achievements
          const TA = await updateTiers(user_id,userPoints) // tier achievements
          if(LA){
            unlockedAchievements.push(...LA)
        }
        if(TA){
            unlockedAchievements.push(...TA)
        }
            const gameData = {...result.rows[0],tier_goal,tier_progress,points_left,unlockedAchievements}
            res.status(200).json(gameData)
            
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'Internal server error'})
        }
    }
}

//get user positions on leaderboard
export async function leaderboard(req:Request,res:Response) {
    try {
        const leaderboard = await client.query(`
        SELECT users.id,profile_image,username,g.points,
        RANK() OVER (ORDER BY g.points DESC) as position 
        FROM users
        LEFT JOIN user_game_data as g
        ON g.user_id = users.id
        LIMIT 25
         `)
        res.status(200).json(leaderboard.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({message:'Internal server error'})
    }

}

//get user position
export async function leaderboardPosition(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
            const user_id=req.user.id
         const position = await client.query(`
            WITH user_game_data AS(
            SELECT points,user_id,
            RANK() OVER (ORDER BY points DESC) as position 
            FROM user_game_data)
            select g.position,users.id,profile_image,username,g.points
            FROM users
            LEFT JOIN user_game_data as g
            ON g.user_id = users.id
            where user_id = $1`,[user_id]) 
            
           
            
            res.status(200).json(position.rows[0])
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
    }
}

//get challenges 
export async function achievements(req:Request,res:Response) {
    if(req.isAuthenticated()){
        const user_id = req.user.id
        try {
            const achievements = await client.query(`
                select ua.user_id,ua.unlocked,ua.unlocked_at::TEXT,achievements.*
                FROM achievements
                JOIN user_achievements ua on achievements.id = ua.achievement_id
                WHERE ua.user_id  = $1 ORDER BY achievements.id
            `,[user_id])
            const tierProgress = await client.query(` 
                select a.id,a.reward,a.goal, ud.points as progress
                FROM achievements a
                JOIN user_achievements ua on a.id = ua.achievement_id
				left join user_game_data ud on ua.user_id = ud.user_id
                WHERE ua.user_id = $1 and type ='tier'	
                `,[user_id])

            const quizProgress = await client.query(`
                select a.id,a.reward,a.goal,ud.completed_quizzes as progress
                FROM achievements a
                JOIN user_achievements ua on a.id = ua.achievement_id
				left join user_game_data ud on ua.user_id = ud.user_id
                WHERE ua.user_id = $1 and type ='quiz'	
                `,[user_id])
            res.status(200).json({
                achievements:achievements.rows,
                tierProgress:tierProgress.rows,
                quizProgress:quizProgress.rows
            })
        } catch (error) {
            console.error(error)
            res.status(500).json({message:'internal server error'})
        }
    }
}

//following achievements
export async function followAchievements(req:Request,res:Response) {
    if(req.isAuthenticated()){
        try {
        const user_id = req.user.id 
        const{socialApp}=req.body 
        
        let unlockedAchievements=[]
            const achievement = await client.query(`
                SELECT a.id, ua.unlocked,a.reward,a.title,a.goal 
                    FROM achievements a
                    JOIN user_achievements ua ON ua.achievement_id = a.id
                    WHERE ua.user_id = $1 AND a.title = $2;
                `,[user_id,socialApp])
                
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
                const SSA =await updateSSA(user_id)
                if(SSA){
                    unlockedAchievements.push(...SSA)
                }
            }
            if(unlockedAchievements.length>0){
                res.status(200).json(unlockedAchievements)
            }else{
                res.status(200).json({messages:'followed'})
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({message:'Internal Server Error'})
            
        }
    }
}