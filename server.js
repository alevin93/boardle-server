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

app.post('/submit', async (req, res) => {
  let errorflag = await handleSubmission(req.body.user, req.body.data, req.body.comment);

  if (errorflag) {
      return res.send({ data: "You already sent that game!" });
  }

  res.sendStatus(200);
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

app.get('/getdata/54321', (req, res) => {
   fs.readFile('./data.json', 'utf8', (err, jsonString) => {

    const existingData = JSON.parse(jsonString);
    return res.json(existingData);
   })
})

app.post('/addFriend', (req, res) => {
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {
    if(err) {
      console.error("Error reading file:", err);
      return res.status(500);
    }
    try {
      const existingData = JSON.parse(jsonString);

      // Find the matching player
      const playerIndex = existingData.findIndex(entry => entry.private === req.body.user);

      if (playerIndex === -1) {
        return res.status(404).json({ error: 'Player not found' }); 
      }

      let newData = existingData[playerIndex];

      for(let x = 0; x < existingData[playerIndex].friends.length; x++) {
        if(existingData[playerIndex].friends[x] === req.body.friend) {
          return res.send("You already have that friend!").status(200);
        }
      }
      let playerFoundFlag = false;

      for(let x = 0; x < existingData.length; x++) {
        if(existingData[x].public === req.body.friend) {
          playerFoundFlag = true;
        }
      }

      if(!playerFoundFlag) {
        return res.send("Friend not found!").status(200);
      }

      existingData[playerIndex].friends.push(req.body.friend);



      fs.writeFile('./data.json', JSON.stringify(existingData), (err) => {
        if(err) {
          console.error("Error writing file:", err);
          return res.status(500);
        }
      })
    } catch(err) {
      console.error('Error parsing JSON: ', err);
      return res.status(500);
    }

  })
  // TO DO CREATE DATABASE ENTRY HERE
  return res.sendStatus(200);
})
  
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
          'INSERT INTO users (name, private, public) VALUES (?, ?, ?)',
          [newData.name, newData.private, newData.public]
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

const handleSubmission = async (user, data, comment) => {
  // 1. Retrieve the User's ID

  if (user === null) {
      console.log("Player not found.");
      return true; 
  }

  // 2. Your game and date logic 
  const date = getDate();
  const gameName = findGameName(data);
  const formatted = formatGame(data);

  const existingGame = db.query(
    'SELECT id FROM games WHERE user_id = ? AND date = ? AND game_name = ?',
    [user, date, gameName]
  );

  if(comment === "" || comment === null) {
    comment = "";
  }
  
  if (existingGame.length > 0) {
    return true;
  }

  console.log(user, date, gameName, formatted, comment)

  // 3. Database Insertion
  const query = 'INSERT INTO games (user_id, date, game_name, text, comment) VALUES (?, ?, ?, ?, ?)';
  const result = db.query(query, [user, date, gameName, formatted, comment]);
  const gameId = result.insertId;

  console.log("HandleSubmissionFinished")
  return false;
};

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