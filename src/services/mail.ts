import nodemailer from 'nodemailer';

export function sendMail(email: string | string[], subject: string, message: string): Promise<void> {
  return new Promise(async(resolve, reject) => {
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
    const mailList = Array.isArray(email) ? email : [email]
    try {
      const emailPromises = mailList.map((email) => {
        const mailOptions = {
          from: "varsitysteps@gmail.com",
          to: email,
          subject: subject,
          text: message,
        };
 
        return transporter.sendMail(mailOptions)
        .then(info => console.log(`✅ Email sent to ${email}: ${info.response}`))
        .catch(error => console.error(`❌ Failed to send email to ${email}:`, error));
    });
    await Promise.all(emailPromises); // Wait for all emails to be sent
      resolve();
    } catch (error) {
      reject(new Error("Email sending failed"));
    }
  });
}
