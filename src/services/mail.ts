import nodemailer from 'nodemailer'
import { Request, Response } from 'express';

function sendMail(email:any,subject:any,message:any,res:Response){
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "varsitysteps@gmail.com", // Your Gmail email address
        pass: "bigj cpur fofy otzs", // Your Gmail password or an app-specific password
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    const mailOptions = {
      from: "varsitysteps@gmail.com",
      to: email, 
      subject: subject,
      text: `${message}`,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
        
      } else {
        console.log("Email sent: " + info.response);
        res.status(200).send("Email sent successfully");
      }
    });
  } catch (error) {
    console.error(error)
    return res.status(500).json({message:'Internal server error'})
  }
    
}

export {sendMail}