import { Request, Response } from 'express';
import { client } from '../services/connect';
import { deleteImage } from '../services/awsconfig';

//function to save post
export async function savePost(req:Request,res:Response) {
    
    const {title,content,tags,description,type} = req.body
    const files = req.files as any
    
    console.log(description)
    const userId = req.user?.id
  

    try {
      const result = await client.query(`
        INSERT INTO posts(user_id,title,tags,description,tiptap_content,type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[userId,title,tags,description,content,type])
        
        const post_id = result.rows[0].post_id
        if(files){
          const insertImages = files.map(async(file:any)=>{
            await client.query(`INSERT INTO post_images (post_id,image_url) VALUES ($1,$2)`,[post_id,file.location])
          })
        }
      const newPost = await client.query(`
        SELECT posts.*, 
        ARRAY_AGG(post_images.image_url) AS image_urls,
	      ARRAY_AGG(post_images.image_id) AS image_ids
        FROM posts
        LEFT JOIN post_images ON posts.post_id = post_images.post_id
        WHERE posts.post_id = $1
        GROUP BY posts.post_id;

        `,[post_id])
        res.status(200).json(newPost.rows[0])
    } catch (error) {
      console.error(error)
      res.status(500)
    }

res.status(200)
}  




export async function fetchPosts(req:Request,res:Response){
  try {
    const userId = req.user?.id
    const result = await client.query(`
      SELECT posts.*, 
        ARRAY_AGG(post_images.image_url) AS image_urls,
	      ARRAY_AGG(post_images.image_id) AS image_ids
        FROM posts
        LEFT JOIN post_images ON posts.post_id = post_images.post_id
        WHERE posts.user_id = $1
        GROUP BY posts.post_id
        ORDER BY posts.created_at DESC;
      `,[userId])
      res.status(200).json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500)
  }  
}

export async function editpost(req:Request,res:Response) {
  if(req.isAuthenticated()){
    const {title,content,description,removedImages,tags,existingImages,post_id} = req.body
    const files = req.files as any
try {
  
  if (removedImages && removedImages.length > 0) {
    const images = Array.isArray(removedImages) ? removedImages : [removedImages];
  
    images.forEach(async (img: any) => {
      await deleteImage(img);
      await client.query(`DELETE FROM post_images WHERE image_url = $1`, [img]);
    });
  }
  if(files){
    await files.map(async(file:any)=>{
      await client.query(`INSERT INTO post_images (post_id,image_url) VALUES ($1,$2)`,[post_id,file.location])
    })
  }
console.log(tags);

   await client.query(`
    UPDATE posts SET title = $1, tiptap_content = $2, tags = $3, description = $4
    WHERE post_id = $5 RETURNING *
      `,[title,content,tags,description,post_id])
     
      const updatedPost = await client.query(`
        SELECT posts.*, 
        ARRAY_AGG(post_images.image_url) AS image_urls,
	      ARRAY_AGG(post_images.image_id) AS image_ids
        FROM posts
        LEFT JOIN post_images ON posts.post_id = post_images.post_id
        WHERE posts.post_id = $1
        GROUP BY posts.post_id;

        `,[post_id])
      
      res.status(200).json(updatedPost.rows[0])
} catch (error) {
  console.error(error)
  res.status(500).json({msg:'error'})
}
   

  }else{
    res.status(401)
  }
}

export async function deletePost(req:Request,res:Response) {
  if(req.isAuthenticated()){
    const post_id = req.params.post_id
    console.log(post_id);
    
    try {
      const images = await client.query(`
          SELECT image_url FROM post_images
          WHERE post_id = $1
        `,[post_id])

        if(images?.rowCount !==0 ){
         images.rows.forEach(async(img)=>{
            if(img.image_url !== null){
             const response= await deleteImage(img.image_url)
             console.log(response);
             
            }
          });
          await client.query(`UPDATE post_images SET image_url = $1 WHERE post_id = $2`,[null,post_id])
        }

      await client.query(`
        DELETE FROM posts WHERE post_id = $1
        `,[post_id])
        res.status(200).json({msg:"deleted"})
    } catch (error) {
      console.error(error)
      res.status(500).json({message:'server error'})
    }


  }else{
    res.status(401).json({message:'login'})
  }
}


// function to get all posts
export async function allPosts(req:Request,res:Response) {
  try {
    const result = await client.query(`
      SELECT 
    posts.*, 
    users.id, 
    users.username, 
    users.profile_image,
    ARRAY_AGG(post_images.image_url) AS image_urls
FROM posts
LEFT JOIN post_images ON posts.post_id = post_images.post_id
LEFT JOIN users ON posts.user_id = users.id
GROUP BY posts.post_id,users.id,users.profile_image, users.username
ORDER BY posts.created_at DESC;
      `)
      res.status(200).json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({message:'error'})
  }
  
}

export async function postDetails(req:Request,res:Response) {
  try {
    const post_id = req.params.post_id
    const result = await client.query(`
      SELECT 
    posts.*, 
    users.id, 
    users.username, 
    users.profile_image,
    ARRAY_AGG(post_images.image_url) AS image_urls
FROM posts
LEFT JOIN post_images ON posts.post_id = post_images.post_id
LEFT JOIN users ON posts.user_id = users.id
WHERE posts.post_id = $1
GROUP BY posts.post_id,users.id,users.profile_image, users.username
ORDER BY posts.created_at DESC;
      `,[post_id])
      res.status(200).json(result.rows[0])
  } catch (error) {
    console.log(error)
    res.status(500).json('')
  }

}