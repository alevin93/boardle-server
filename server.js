const express = require('express');
require("dotenv").config()
const corsOptions = require('./corsOptions');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT;
const db = require('./db');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors(corsOptions));
app.use(express.json());



//connectDB();

app.get('/check', (req, res) => {
  res.send("Connection working!").status(200);
})

app.post('/submit', (req, res) => {
  const { user, data, comment } = req.body; 

  db.query('SELECT id, name FROM users WHERE private = ?', [user], (error, result) => {
      if (error) {
          console.error("Error fetching userId:", error);
          return res.status(500).json({ error: "Internal server error" }); 
      }

      if (result.length === 0) { 
          console.log("Player not found.");
          return res.send({ error: "Player not found" }); 
      }

      const userId = result[0].id; // Assuming 'id' is the column name
      const name = result[0].name
      // ... Your game and date logic 
      const date = getDate();
      const gameName = findGameName(data);
      const formatted = formatGame(data, gameName);

      if(comment == null) {
          comment = "";
      }

      db.query( 
          'SELECT id FROM games WHERE user_id = ? AND date = ? AND gameName = ?',
          [userId, date, gameName],
          (error, existingGameResult) => {
              if (error) {
                  console.error("Error checking existing game:", error);
                  return res.status(500).json({ error: "Internal server error" }); 
              }

              if (existingGameResult.length > 0) {
                  return res.send({ error: "You already sent that game!" });
              }

              // Database Insertion 
              const query = 'INSERT INTO games (user_id, player, date, gameName, text, comment) VALUES (?, ?, ?, ?, ?, ?)';
              db.query(query, [userId, name, date, gameName, formatted, comment], (error, insertResult) => {
                  if (error) {
                      console.error("Error inserting game:", error);
                      return res.status(500).json({ error: "Internal server error" }); 
                  }

                  const gameId = insertResult.insertId;
                  console.log("Game inserted with ID:", gameId);
                  res.sendStatus(200); // Or send the gameId back if needed
              }); 
          }
      );
  });
});



app.post('/restoreUser', async (req, res) => {
  const user = req.body.user;

  console.log("RESTORE USER IS: ", user)

  try {
      // 1. Check if user exists
      db.query('SELECT private, public, name FROM users WHERE private = ?', [user], (error, userResult) => {

        if (userResult.length === 0) {
          return res.status(404).json({ error: 'User not found' }); 
      }

      // 2. Extract relevant data
      const private = userResult[0].private;
      const public = userResult[0].public;
      const name = userResult[0].name  

      // 3. Send successful response
      res.json(JSON.stringify({ private: private, public: public, name: name })); 

      });

  } catch (err) {
      console.error('Error restoring player:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/linkFriends', (req, res) => {
  const { user, friend } = req.body;

  if (user === friend) {
    return res.status(400).json({ error: 'You cannot add yourself even if you are lonely' })
  }

  // 1. Fetch User and Friend Data
  db.query('SELECT id, name, friends FROM users WHERE public = ?', [user], (error, userResult) => {
      if (error) {
          console.error('Error fetching user:', error);
          return res.status(500).json({ error: 'Internal server error' });
      }
      if (userResult.length === 0) {
          return res.status(404).json({ error: 'User not found' }); 
      }

      const userId = userResult[0].id;
      const userName = userResult[0].name;
      const userFriends = userResult[0].friends;

      db.query('SELECT id, name, friends FROM users WHERE public = ?', [friend], (error, friendResult) => {
          if (error) {
              console.error('Error fetching friend:', error);
              return res.status(500).json({ error: 'Internal server error' });
          }
          if (friendResult.length === 0) {
              return res.status(404).json({ error: 'Friend not found' }); 
          }

          const friendId = friendResult[0].id;
          const friendName = friendResult[0].name;

          for(let x = 0; x < userFriends.length; x++) {
            if (userFriends[x].id === friendId) {
              return res.status(400).json({ error: "You already have that friend!" })
            }
          }

          // 2. Update Friends Arrays - Nested for Sequential Execution
          updateFriends(userId, friendId, userName, friendName, (err) => { 
              if (err) {
                  console.error('Error linking friends:', err);
                  return res.status(500).json({ error: 'Internal server error' });
              }
              res.sendStatus(200); // Success!
          });
      });
  });
});

// Helper function for database updates
function updateFriends(userId, friendId, userName, friendName, callback) {
  db.query(
      'UPDATE users SET friends = JSON_ARRAY_APPEND(friends, \'$\', JSON_OBJECT(\'id\', ?, \'name\', ?)) WHERE id = ?',
      [friendId, friendName, userId],
      (error) => {
         if (error) { return callback(error); } // Handle error within update

         // Perform the second update
         db.query(
              'UPDATE users SET friends = JSON_ARRAY_APPEND(friends, \'$\', JSON_OBJECT(\'id\', ?, \'name\', ?)) WHERE id = ?',
              [userId, userName, friendId],
              (error) => {
                  callback(error); // Pass error upwards (or null if both updates succeeded)
              }
         );
      }
  );
}




  
app.post('/createUser', async (req, res) => {
  console.log("Create new user has been run");
  let private = generateKey(15)
  let public = generateKey(9)
  const newData = {
      name: req.body.name,
      private: private,
      public: public,
      friends: []
  };

  try {
      const result = db.query(
          'INSERT INTO users (name, private, public, friends) VALUES (?, ?, ?, JSON_ARRAY())',
          [newData.name, newData.private, newData.public, newData.friends]
      );

      const userId = result.insertId; // Get the newly inserted user's ID
      console.log(result);

      res.json({ private: private, public: public }); // Return the ID of the new user
  } catch (err) {
      console.error("Error creating user:", err);
      if (err.code === 'ER_DUP_ENTRY') { // Handle unique constraint errors
          res.status(500).json({ error: 'User with that key already exists' });
      } else {
          res.sendStatus(500); 
      }
  }
});

app.post('/getfriendsdata', async (req, res) => {
  const user = req.body.user;
  const date = req.body.date; 

  console.log("GETFRIENDSDATA USER IS: ", user);

  try {
      // 1. Fetch User's Friends and ID

      db.query('SELECT id, friends FROM users WHERE public = ?', [user], (error, userResult) => {
        if (error) {
            console.error('Error fetching friend:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (userResult.length === 0) {
            return res.status(404).json({ error: 'Friend not found' }); 
        }

        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = userResult[0].id;
        const friendIds = userResult[0].friends.map((friend) => friend.id);
        
        friendIds.unshift(userId);

        console.log(friendIds)
        console.log(userId)
        // 2. Combined Game Data Query (Union)
        const friendGamesQuery = `SELECT gameName, text, comment, player FROM games WHERE user_id IN (?) AND date = ?`;


        // Execute the combined query
        db.query(friendGamesQuery, [friendIds, date, userId, date],  (error, results) => {
          if (error) { 
              console.log(error)
          } else {
              const combinedResults = results; // Access results here
              console.log(combinedResults, "\n\n\n")
              res.json(JSON.stringify(combinedResults));
          }
        });
    })

  } catch (err) {
      console.error('Error fetching friend game data:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});



app.listen(port, () => {
  console.log(`Backend listening on port ${port}`)
})



function generateKey(length) {
  var characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var result = '';
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function getDate() {
  let currentDate = new Date();
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth() + 1; // Months are 0-indexed
  if(month < 10) { month = `0${month}`}
  let day = currentDate.getDate();
  let formattedDate = `${year}-${month}-${day}`; 
  return(formattedDate)
}

function findGameName(data) {
  
  data = data.replace(/^\s+|[^\w\s]+/g, "")
  const index = data.indexOf(' ');

  if (index === -1) { //no space found
    return null;
  }
  return data.substring(0, index);
}

function formatGame(data, name) {

  if (name === "Bandle") {
    data = bandleTrim(data);
  }

  if (name === "Costcodle") {
    data = costcodleTrim(data);
  }

  return data.replace(/\n/g, "~");
}

function bandleTrim(str) {
  const index = str.indexOf('F');  // Find the index of the first 'F'
   if (index !== -1) {  // If 'F' is found
       return str.substring(0, index); // Return the portion before 'F'
   } else {
       return str; // If 'F' is not found, return the original string
   }
}

function costcodleTrim(str) {
  const index = str.indexOf('h');  // Find the index of the first 'F'
   if (index !== -1) {  // If 'F' is found
       return str.substring(0, index); // Return the portion before 'F'
   } else {
       return str; // If 'F' is not found, return the original string
   }
}