const express = require('express');
const corsOptions = require('./corsOptions');
const fs = require('fs');
const path = require('path');
const port = 4000;
const cors = require('cors');
const connectDB = require('./db');

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
//connectDB();

app.post('/submit', (req, res) => {
  let errorflag = handleSubmission(req.body.user, req.body.data)
  
  if(errorflag) {
    return res.sendStatus(400)
  }
  
  res.sendStatus(200);
})

app.post('/restoreUser', (req, res) => {
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {

    const existingData = JSON.parse(jsonString);
    
    // Find the index of the matching player
    const playerIndex = existingData.findIndex(entry => entry.private === req.body.user);

    // Check if the player was found
    
    const player = existingData[playerIndex]; // Get a reference to the player


    console.log("Restored the account of " + player.name);

    return res.json(player);

    

  })
})
  
app.post('/createUser', (req, res) => {
  console.log("Create new user has been run");
  console.log(req.body.name)
  let newData = {
    name : req.body.name,
    private : generateKey(15),
    public : generateKey(15),
    dates : null
  }
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {
    if(err) {
      console.error("Error reading file:", err);
      return res.status(500);
    }
    try {
      const existingData = JSON.parse(jsonString);

      const hasDuplicate = existingData.some( entry => entry.private === newData.private || entry.public === newData.public)

      if(hasDuplicate) {
        return res.status(500);
      }

      const updatedData = [...existingData, newData];

      fs.writeFile('./data.json', JSON.stringify(updatedData), (err) => {
        if(err) {
          console.error("Error writing file:", err);
          return res.status(500);
        }
        console.log('Data appended successfully');
      })
    } catch(err) {
      console.error('Error parsing JSON: ', err);
      return res.status(500);
    }

  })
  // TO DO CREATE DATABASE ENTRY HERE
  return res.json(newData);
})

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`)
})


const handleSubmission = async (user, data) => {
  fs.readFile('./data.json', 'utf8', (err, jsonString) => {

    const existingData = JSON.parse(jsonString);

    // Find the index of the matching player
    const playerIndex = existingData.findIndex(entry => entry.private === user);

    // Check if the player was found
    if (playerIndex !== -1) {
      const player = existingData[playerIndex]; // Get a reference to the player

      // Your game and date logic
      const date = getDate();
      const gameName = findGameName(data);
      const formatted = formatGame(data);

      if (gameName === null) {
        return true;
      }

      if (player.dates == null) {
        player.dates = {};  // Initialize the 'dates' object
      }
    
      if (!player.dates[date]) { // Check if the date key exists
        player.dates[date] = { games: {} }; 
      }
    
      player.dates[date].games[gameName] = { 
        text: formatted // Assuming you meant 'text' instead of 'test'
      }; 
    

      // Replace the old player with the updated one
      existingData[playerIndex] = player;

      // Write the modified data back to the file
      fs.writeFile('./data.json', JSON.stringify(existingData), (err) => {
        // ...
      });

    } else {
      // Handle the case where the player wasn't found
      console.log("Player not found.");
    }

    return false;
  });
}

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
  const index = data.indexOf(' ');

  if (index === -1) { //no space found
    return null;
  }
  return data.substring(0, index);
}

function formatGame(data) {
  return data.replace(/\n/g, "~");
}

function tokenizeData(data) {

}