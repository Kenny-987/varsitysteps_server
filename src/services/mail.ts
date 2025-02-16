import nodemailer from 'nodemailer';

export function sendMail(email: string, subject: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
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
      text: message,
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return reject(error);
      } else {
        console.log("Email sent: " + info.response);
        return resolve();
      }
    });
  });
}
