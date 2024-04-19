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

  db.query('SELECT id FROM users WHERE private = ?', [user], (error, result) => {
      if (error) {
          console.error("Error fetching userId:", error);
          return res.status(500).json({ error: "Internal server error" }); 
      }

      if (result.length === 0) { 
          console.log("Player not found.");
          return res.send({ error: "Player not found" }); 
      }

      const userId = result[0].id; // Assuming 'id' is the column name

      // ... Your game and date logic 
      const date = getDate();
      const gameName = findGameName(data);
      const formatted = formatGame(data);

      if(comment == null) {
          comment = "";
      }

      db.query( 
          'SELECT id FROM games WHERE user_id = ? AND date = ? AND game_name = ?',
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
              const query = 'INSERT INTO games (user_id, date, game_name, text, comment) VALUES (?, ?, ?, ?, ?)';
              db.query(query, [userId, date, gameName, formatted, comment], (error, insertResult) => {
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



app.post('/restoreUser', (req, res) => {
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {

    const existingData = JSON.parse(jsonString);

    console.log("Looking for: " + req.body.user);
    
    // Find the index of the matching player
    const playerIndex = existingData.findIndex(entry => entry.private === req.body.user);

    // Check if the player was found
    
    const player = existingData[playerIndex]; // Get a reference to the player

    return res.json(player);

  })
})

app.post('/addFriend', async (req, res) => {
  const { user, friend } = req.body;

  try {
      // ... (Friend existence check - This part can remain similar) ... 

      // 2. Retrieve Current User Data 
      db.query(
          'SELECT id, friends FROM users WHERE private = ?',
          [user],
          (error, userResult) => {
              if (error) {
                  console.error("Error fetching user data:", error);
                  return res.status(500).json({ error: 'Internal server error' });
              }

              if (userResult.length === 0) {
                  return res.status(404).json({ error: 'Player not found' });
              }

              const userData = userResult[0];

              // ... (Duplicate Check) ...

              // 4. Fetch Friend's Name
              db.query(
                  'SELECT name, id FROM users WHERE public = ?',
                  [friend],
                  (error, friendNameResult) => {
                      if (error) {
                          console.error("Error fetching friend name:", error);
                          return res.status(500).json({ error: 'Internal server error' }); 
                      }

                      if (friendNameResult.length === 0) {
                          return res.status(400).json({ error: 'Friend name not found' });
                      }

                      if (userResults[0].id === friendNameResult[0].id) {
                        return res.status(400).json({ error: "No matter how lonely you are you can't add yourself as a friend"})
                      }

                      const friendName = friendNameResult[0].name;
                      const friendId = friendNameResult[0].id;

                      for(let x = 0; x < userData.friends.length; x++) {
                        if(userData.friends[x].id === friendId) {
                          res.status(400).json({ error: 'You already have that friend!'})
                        }
                      }

                      // 5. Update Friends Array
                      userData.friends.push({ id: friendId, name: friendName });  

                      // 6. Database Update 
                      db.query(
                          'UPDATE users SET friends = ? WHERE id = ?',
                          [JSON.stringify(userData.friends), userData.id],
                          (error, updateResult) => {
                              if (error) {
                                  console.error("Error updating friends:", error);
                                  return res.status(500).json({ error: 'Internal server error' });
                              }
                          }
                      ); 
                  }
              );
          }
      );
      db.query(
        'SELECT id, friends FROM users WHERE public = ?',
        [friend],
        (error, userResult) => {
            if (error) {
                console.error("Error fetching user data:", error);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (userResult.length === 0) {
                return res.status(404).json({ error: 'Player not found' });
            }

            const userData = userResult[0];

            // ... (Duplicate Check) ...

            // 4. Fetch Friend's Name
            db.query(
                'SELECT name, id FROM users WHERE private = ?',
                [user],
                (error, friendNameResult) => {
                    if (error) {
                        console.error("Error fetching friend name:", error);
                        return res.status(500).json({ error: 'Internal server error' }); 
                    }

                    if (friendNameResult.length === 0) {
                        return res.status(400).json({ error: 'Friend name not found' });
                    }

                    const friendName = friendNameResult[0].name;
                    const friendId = friendNameResult[0].id;

                    for(let x = 0; x < userData.friends.length; x++) {
                      if(userData.friends[x].id === friendId) {
                        res.status(400).json({ error: 'You already have that friend!'})
                      }
                    }

                    // 5. Update Friends Array
                    userData.friends.push({ id: friendId, name: friendName });  

                    // 6. Database Update 
                    db.query(
                        'UPDATE users SET friends = ? WHERE id = ?',
                        [JSON.stringify(userData.friends), userData.id],
                        (error, updateResult) => {
                            if (error) {
                                console.error("Error updating friends:", error);
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                        }
                    ); 
                }
            );
        }
    );
  } catch (err) { 
      console.error('Error adding friend:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

  
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

app.post('/getFriendsData', (req, res) => {
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {
    if (err) {
      console.error("File read error:", err);
      return res.status(500).json({ error: 'File read error' }); 
    }

    try {
      const existingData = JSON.parse(jsonString);

      // Find the matching player
      const playerIndex = existingData.findIndex(entry => entry.private === req.body.user);


      if (playerIndex === -1) {
        return res.status(404).json({ error: 'Player not found' }); 
      }
      let friendsArray = [existingData[playerIndex]];

      existingData.forEach(element => {
        for(i = 0; i < existingData[playerIndex].friends.length; i++) {
          if(element.public === existingData[playerIndex].friends[i]) {
            let publicPlayerData = element;
            delete publicPlayerData.private;
            delete publicPlayerData.friends;
            friendsArray.push(publicPlayerData);
          }
        }
      });

      res.json(JSON.stringify(friendsArray));

    } catch (err) {
      console.error("Error parsing JSON:", err);
      return res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
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

function formatGame(data) {

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