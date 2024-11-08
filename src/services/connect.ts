import { Client } from 'pg';
import 'dotenv/config'

//const connectionString = process.env.connectionString
const connectionString = process.env.productionConnectionString
const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false, // Disable certificate verification
    }, 
  }); 
      
  const connectToDatabase = async () => {
    try {
      await client.connect();
      console.log('Connected to PostgreSQL database');
    } catch (err) { 
      console.error('Error connecting to the database', err);
    }
  };
   
  const disconnectFromDatabase = async () => {
    try {
      await client.end();
      console.log('Disconnected from PostgreSQL database');
    } catch (err) {
      console.error('Error disconnecting from the database', err);
    }
  };
  
  export { client, connectToDatabase, disconnectFromDatabase };



  //pg trigger code

// DECLARE
// notification_data JSON;
// student_details JSON;
// BEGIN
// -- Fetch student details
// SELECT json_build_object(
//     'username', u.username,
//     'programme', s.programme,
//     'location', s.location
// ) INTO student_details
// FROM users u
// JOIN students s ON s.user_id = u.id
// WHERE s.user_id = NEW.user_id;

// -- Construct JSON object with notification and student details
// notification_data := json_build_object(
//     'user_id', NEW.user_id,
//     'message', NEW.message,
//     'type', NEW.type,
//     'student_details', student_details
// );

// -- Notify the application with the notification details
// PERFORM pg_notify('new_notification', notification_data::text);
// RETURN NEW;
// END;