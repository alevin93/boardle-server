const express = require('express');
require("dotenv").config()
const corsOptions = require('./corsOptions');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT;
const db = require('./db');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors(corsOptions));
app.use(express.json());


//connectDB();

app.get('/check', (req, res) => {
  res.send("Connection working!").status(200);
})

app.post('/submit', async (req, res) => {
  var { user, data, date, comment } = req.body;
  if (req.body.token) {
    token = req.body.token;
    let data = await decodeJWT(req.body.token); // Await the decoding
    
    user = await data.private;
    date = req.body.date;
  }
  console.log("Submit request handled")

  if (data === "" || '') {
  }

  console.log(data);

  db.query('SELECT id, name FROM users WHERE private = ?', [user], (error, result) => {
      if (error) {
          console.error("Error fetching userId:", error);
          return res.status(500).json({ error: "Internal server error" }); 
      }

      if (result.length === 0) { 
          console.log("Player not found.");
          return res.send({ error: "Player not found" }); 
      }

      const userId = result[0].id; 
      const name = result[0].name;
      const gameName = findGameName(data);
      const formatted = formatGame(data, gameName);

      if(gameName === null) {
        return;
      }
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
                  res.sendStatus(200); // Or send the gameId back if needed
              }); 
          }
      );
  });
});

app.post('/fetchFriends', async (req, res) => {
  const userKey = req.body.user; // Assuming user key is sent as a query parameter
  console.log("userKey is: ",userKey);
  // Database query using prepared statement to prevent SQL injection
  const efriends = db.query('SELECT friends FROM users WHERE private = ?', [userKey], (error, userInfo) => {

  console.log(userInfo[0].friends)

  res.json({ 'friends':  JSON.stringify(userInfo[0].friends)});

  });
})

app.post('/restoreUser', async (req, res) => {
  const user = req.body.user;

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

app.post('/linkFriends', async (req, res) => {
  var { user, friend } = req.body;
  if (req.body.token) {
    token = req.body.token;
    let data = await decodeJWT(req.body.token); // Await the decoding
    console.log(data);
    console.log(data.private);
    user = await data.share;
  }

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
  console.log(req.body.user);
  var user = '';
  var date = '';
  var token = null;
  if (req.body.token) {
    token = req.body.token;
    let data = await decodeJWT(req.body.token); // Await the decoding
    console.log(data);
    console.log(data.share);
    user = await data.share;
    date = req.body.date;
  }
  else {
    user = req.body.user;
    date = req.body.date;
  }
  if(date === "NaN-NaN-NaN") { send.res(500).json(JSON.stringify({ error: 'The server didnt receive a date! :*('})); return; }
  if(!user) { res.status(500).json(JSON.stringify({ error: "The server didn't receive a user"})); return}

  console.log("User: " + user +", Date: " + date);

  try {
      // 1. Fetch User's Friends and ID

      db.query('SELECT id, friends, name, private FROM users WHERE public = ?', [user], (error, userResult) => {
        if (error) {
            console.error('Error fetching friend:', error);
            return res.status(500).json(JSON.stringify({ error: 'Error fetching friends data' }));
        }
        console.log()
        if (userResult.length === 0) {
          return  ; 
        }
        if (userResult.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if(token === null) {
          const userInfo = {
            "id" : userResult[0].id,
            "private" : userResult[0].private,
            "name" : userResult[0].name,
            "share" : user
          }
          token = generateJWT(userInfo);
          console.log("Token generated")
        }


        const userId = userResult[0].id;
        const friendIds = userResult[0].friends.map((friend) => friend.id);
        
        friendIds.unshift(userId);

        // 2. Combined Game Data Query (Union)
        const friendGamesQuery = `SELECT gameName, text, comment, player FROM games WHERE user_id IN (?) AND date = ?`;


        // Execute the combined query
        db.query(friendGamesQuery, [friendIds, date, userId, date],  (error, results) => {
          if (error) { 
              console.log(error)
          } else {
              const combinedResults = results; // Access results here
                console.log("JSON STRINGIFY",JSON.stringify(token))
                res.json(JSON.stringify({results: combinedResults, token: token}));

          }
        });
    })

  } catch (err) {
      console.error('Error fetching friend game data:', err);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/register', async (req, res) => {
  
  const { name, email, unhashed_password, private } = req.body;
  const password = await hashPassword(unhashed_password, email);

  if (private) {
    try {
      const user = db.query(
        'SELECT * FROM users WHERE private = ?',
        [private], (error, result) => {
          if(!result[0]){
            res.status(500).json(JSON.stringify({ "error": "Cannot find that private key!" }));
            return;
          }
          else if(error) {
            res.status(500).json(JSON.stringify({ "error": error}))
          }
          const userInfo = {
            "id" : result[0].id,
            "private" : private,
            "name" : result[0].name,
            "share" : result[0].public
          }
          try {
            console.log(password);
            db.query(
              'UPDATE users SET name = ?, username = ?, password = ? WHERE private = ?',
              [name === ''? userInfo.name : name, email, password, private] // Array of parameters
            );
          } catch (error) {
            console.error(error);
            deleteSaltEntry(email);
            res.status(500).json({ error: error });
          }
          const token = generateJWT(userInfo);
          console.log(userInfo)
          try {
            res.json(JSON.stringify({
              'private': private,
              'name': result[0].name,
              'share': result[0].public,
              'token': token
            }));
          } catch (error) {
            console.log(error);
          }
        }
      );
    } catch (error) {
      deleteSaltEntry(email);
      console.log(error);
      
    }
  }
  else {
    let private = generateKey(15);
    let public = generateKey(9);
    const friends = [];

      const result = db.query(
        'INSERT INTO users (name, private, public, username, password, friends) VALUES (?, ?, ?, ?, ?, JSON_ARRAY())',
        [name, private, public, email, password, friends],
        (error, result) => {
            if (error) {
                res.status(500).json(JSON.stringify({ error: 'Email is taken!'}));
                return; // Handle error
            }
            
            const userInfo = {
                "id": result.insertId || null, // Use insertId if available, otherwise null
                "private": private,
                "name": name,
                "share": public // Assuming public is the share field
            };
          const token = generateJWT(userInfo);
            console.log(userInfo);
            try {
              res.json(JSON.stringify({
                'private': private,
                'name': name,
                'share': public,
                'token': token
              }))
            }
            catch (error) {
              console.log(error);
              deleteSaltEntry(email);
            }
      })
  }
});

app.post('/login', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  db.query('SELECT salt FROM salts WHERE username = ?', [username], (error, saltData) => {

    

    if (saltData.length === 0) {
      return false; // Username not found
    }

    const salt = saltData[0].salt;
    console.log('salt is: ', parseInt(salt));
    bcrypt.hash(password, parseInt(salt)).then(hashedPassword => {

    db.query('SELECT password FROM users WHERE username = ?', [username], (error, passwordData) => {

    const passwordMatch =  bcrypt.compare(hashedPassword, passwordData[0].password);

  
  if (passwordMatch) {
    const query = 'SELECT id, public, private, name FROM users WHERE username = ?';
    db.query(query, [username], (error, results) => {
      if (error) {
        console.error(error);
        return callback(error, null);  // Pass error to callback
      }

      if (!results.length) {
        return callback(null, null);  // No user found, pass null to callback
      }

      const user = {
        id: results[0].id,
        share: results[0].public,
        private: results[0].private,
        name: results[0].name,
      };
      console.log(user);
      const token = generateJWT(user);

      res.json(JSON.stringify({
        'private': results[0].private,
        'name': results[0].name,
        'share': results[0].public,
        'token': token
      }))
      
      });
    }
  
    else if (!result) {
      res.status(405).json(JSON.stringify({ error: "Incorrect username or password"})); return;
    }
    else {
      console.log("Nothing interesting happened");
    }
  })
  })
  })
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

function generateJWT(payload) {
  // Default options
  const defaultOptions = {
  
  };

  return jwt.sign(payload, process.env.SECRET , defaultOptions);
}

async function decodeJWT(token) {
  try {
    // Split the token into header, payload, and signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
  
    // Base64 decode the payload (assuming JWT is using base64 encoding)
    const decodedPayload = atob(parts[1]);
    // Parse the decoded payload from JSON
    return JSON.parse(decodedPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

async function hashPassword(password, username) {
  // Choose a suitable salt rounds value
  const saltRounds = 10;
  try {
    // Generate a random salt for each password
    const salt = saltRounds;

    // Hash the password with the generated salt
    const hash = bcrypt.hash(password, salt);

    // Insert the hashed salt data with username reference into the salt table
    db.query('INSERT INTO salts (username, salt) VALUES (?, ?)', [username, salt]);

    return hash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error; // Or handle the error differently based on your application logic
  }
}

async function verifyPassword(username, password) {
  try {
    const saltData = db.query('SELECT salt FROM salts WHERE username = ?', [username]);

    if (saltData.length === 0) {
      return false; // Username not found
    }

    const salt = await saltData[0].salt;

    const hashedPassword = await bcrypt.hash(password, salt);
    const passwordMatch = await bcrypt.compare(hashedPassword, /* hashed password from database */);

    return passwordMatch;
  } catch (error) {
    console.error("Error verifying password:", error);
    throw error; // Or handle the error differently based on your application logic
  }
}

async function deleteSaltEntry(username) {
  try {
    // Prepare the SQL statement with a placeholder for username
    const sql = 'DELETE FROM salts WHERE username = ?';
    const [deleteResult] = await db.execute(sql, [username]);

    // Check if any rows were deleted
    if (deleteResult.affectedRows === 1) {
      console.log("Salt entry for", username, "deleted successfully.");
    } else {
      console.log("No salt entry found for", username);
    }
  } catch (error) {
    console.error("Error deleting salt entry:", error);
    // Handle errors appropriately based on your application logic
  }
}

function findGameName(data) {

  if(data.includes("New York Times Mini")) {
    return 'Mini Crossword';
  }

  if(data.includes('contexto.me')) {
    return 'Contexto'
  }
  
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

  if (name === 'Mini Crossword') {
    data = miniTrim(data);
  }

  if (name === 'Contexto') {
    data = contextoTrim(data);
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

function miniTrim(text) {
  text = text.replace('I solved the ', '');
  text = text.replace('New York Times Mini Crossword in ', '\n');
  text = text.replace('!','');
  return text;
}

function contextoTrim(text) {
  text = text.replace("I played contexto.me", "Contexto");
  text = text.replace("and got it in ", "\n");
  return text;
}