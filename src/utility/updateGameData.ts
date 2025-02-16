import { client } from '../services/connect';


export async function updateTiers(user_id:any,userPoints:any) {
    
    let unlockedAchievements: object[]=[]
    /// below is funtionality for updating tier achievements   
    const achievementFunc = async(title:any)=>{
        const existingAchievement = await client.query(`
             select ud.points,a.id,ua.unlocked,a.title,a.reward
             from achievements a
             join user_achievements ua on ua.achievement_id = a.id
             join user_game_data ud on  ud.user_id = ua.user_id
             where ud.user_id =$1 and title = $2`,[user_id,title])
             
         return existingAchievement.rows[0]
     }  
     const updateFunc = async(existingAchievement:any)=>{
                // Unlock the achievement if it's not already unlocked
             await client.query(
             `UPDATE user_achievements SET unlocked = true, unlocked_at = NOW()
             WHERE achievement_id = $1 AND user_id = $2`,
             [existingAchievement.id,user_id]);
             await client.query(`
                UPDATE user_game_data SET points = points +$1,achievements = achievements + 1 WHERE user_id = $2
                `,[existingAchievement.reward,user_id])
             unlockedAchievements.push({
              message: `You unlocked the achievement: ${existingAchievement.title}!`,
              })
     }
     
     if(Number(userPoints) >= 50 ){
         const currentTier = await client.query(`
             SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
             if (currentTier.rows[0].tier !== 'Beginner') {
                 await client.query(`
                     UPDATE user_game_data SET tier = 'Beginner' WHERE user_id = $1`, [user_id]);
             }
             const existingAchievement = await achievementFunc('Newcomer')    
             if (existingAchievement && !existingAchievement.unlocked) {
                   await updateFunc(existingAchievement)
                 }         
             }

    if(Number(userPoints) >=250){
     const currentTier = await client.query(`
     SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
     if (currentTier.rows[0].tier !== 'Explorer') {
         await client.query(`
             UPDATE user_game_data SET tier = 'Explorer' WHERE user_id = $1`, [user_id]);
     }
     const existingAchievement = await achievementFunc('Explorer\'s Path')    
     if (existingAchievement && !existingAchievement.unlocked) {
           await updateFunc(existingAchievement)
         } 
     }

    if(Number(userPoints) >=750){
       const currentTier = await client.query(`
       SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
       if (currentTier.rows[0].tier !== 'Scholar') {
           await client.query(`
               UPDATE user_game_data SET tier = 'Scholar' WHERE user_id = $1`, [user_id]);
       }
       const existingAchievement = await achievementFunc('Rising Scholar')    
       if (existingAchievement && !existingAchievement.unlocked) {
             await updateFunc(existingAchievement)
           } 
       }


    if(Number(userPoints) >=1500){
        const currentTier = await client.query(`
        SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
        if (currentTier.rows[0].tier !== 'Mastermind') {
            await client.query(`
                UPDATE user_game_data SET tier = 'Mastermind' WHERE user_id = $1`, [user_id]);
        }
        const existingAchievement = await achievementFunc('Mastermind in the Making')    
        if (existingAchievement && !existingAchievement.unlocked) {
              await updateFunc(existingAchievement)
            } 
        }
        
        if(Number(userPoints) >=3000){
            const currentTier = await client.query(`
            SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
            if (currentTier.rows[0].tier !== 'Elite Thinker') {
                await client.query(`
                    UPDATE user_game_data SET tier = 'Elite Thinker' WHERE user_id = $1`,[user_id]);
            }
            const existingAchievement = await achievementFunc('Elite Thinker')    
            if (existingAchievement && !existingAchievement.unlocked) {
                  await updateFunc(existingAchievement)
                } 
            }
    if(Number(userPoints) >=5000){
        const currentTier = await client.query(`
        SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
        if (currentTier.rows[0].tier !== 'Grandmaster') {
            await client.query(` UPDATE user_game_data SET tier = 'Grandmaster' WHERE user_id = $1`, [user_id]);
              }
            const existingAchievement = await achievementFunc('Grandmaster of Knowledge')    
            if (existingAchievement && !existingAchievement.unlocked) {
                  await updateFunc(existingAchievement)
                } 
            }
    if(Number(userPoints) >=10000){
        const currentTier = await client.query(`
        SELECT tier FROM user_game_data WHERE user_id = $1`, [user_id]);
        if (currentTier.rows[0].tier !== 'Legendary') {
            await client.query(` UPDATE user_game_data SET tier = 'Legendary' WHERE user_id = $1`, [user_id]);
        }
        const existingAchievement = await achievementFunc('Legendary Status')    
        if (existingAchievement && !existingAchievement.unlocked) {
              await updateFunc(existingAchievement)
            } 
        }

     return unlockedAchievements
}


////// updating leaderboard achievement LBA
export async function updateLBA(user_id:any) {
    
    let unlockedAchievements: object[]=[]
 const position = await client.query(`
    WITH user_game_data AS(
    SELECT user_id, RANK() OVER (ORDER BY points DESC) as position 
    FROM user_game_data)
    select g.position
    FROM users
    LEFT JOIN user_game_data as g
    ON g.user_id = users.id
    where user_id = $1`,[user_id])
    
    let achievementName
    if(position.rows[0].position <=3){
        achievementName ='Podium Finisher'
    }
    if(position.rows[0].position==1){
        achievementName ='Leaderboard Ruler'
    }
    else if(!achievementName) return
   
    const achievement= await client.query(`
        SELECT a.id, ua.unlocked,a.reward,a.title,a.goal 
        FROM achievements a
        JOIN user_achievements ua ON ua.achievement_id = a.id
        WHERE ua.user_id = $1 AND a.title = $2
    `, [user_id, achievementName]);

    if(!achievement.rows[0].unlocked){
        await client.query(`
            UPDATE user_achievements SET unlocked = true, unlocked_at = CURRENT_DATE
            WHERE achievement_id = $1 AND user_id = $2
        `, [achievement.rows[0].id, user_id]);
        
        await client.query(`
            UPDATE user_game_data SET points = points +$1,achievements = achievements + 1 WHERE user_id = $2
            `,[achievement.rows[0].reward,user_id])
    
            let message = `You unlocked the achievement: ${achievement.rows[0].title}!`  
            unlockedAchievements.push({
                message
            });
            
    }

return unlockedAchievements
}

// funtion to update social supporter status
export async function updateSSA(user_id:any) {

    let unlockedAchievements: object[] = []

    const existingAchievement = await client.query(`
        select ud.points,a.id,ua.unlocked,a.title,a.reward
        from achievements a
        join user_achievements ua on ua.achievement_id = a.id
        join user_game_data ud on  ud.user_id = ua.user_id
        where ud.user_id =$1 and title = 'Social Media Supporter'`,[user_id])
        
        if(!existingAchievement.rows[0].unlocked){
            const achievements = await client.query(`
                select a.type,ua.unlocked
        from achievements a
        join user_achievements ua on ua.achievement_id = a.id
        join user_game_data ud on  ud.user_id = ua.user_id
        where ud.user_id =$1 and a.type = 'following'
                `,[user_id])
        const followingAchievements = achievements.rows;

        
        if(followingAchievements[0].unlocked && followingAchievements[1].unlocked && followingAchievements[0].unlocked){
            await client.query(
                `UPDATE user_achievements SET unlocked = true, unlocked_at = NOW()
                WHERE achievement_id = $1 AND user_id = $2`,
                [existingAchievement.rows[0].id,user_id]);
                await client.query(`
                   UPDATE user_game_data SET points = points +$1,achievements = achievements + 1 WHERE user_id = $2
                   `,[existingAchievement.rows[0].reward,user_id])
                unlockedAchievements.push({
                 message: `You unlocked the achievement: ${existingAchievement.rows[0].title}!`,
                 })
        }
            
        }
        return unlockedAchievements
}


