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
  let errorflag = handleSubmission(req.body.user, req.body.data, req.body.comment)
  
  if(errorflag) {
    return res.send({ data: "You already sent that game!"})
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
  
app.post('/createUser', (req, res) => {
  console.log("Create new user has been run");
  console.log(req.body.name)
  let newData = {
    name : req.body.name,
    private : generateKey(15),
    public : generateKey(15),
    dates : null,
    friends: [],
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


      if(gameName == "Bandle") {
        data = bandleTrim(data);
      }
      if(gameName == "Costcodle") {
        data = costcodleTrim(data);
      }


      const formatted = formatGame(data);

      if (gameName === null) {
        return true;
      }

      if (player.dates == null) {
        player.dates = {};  // Initialize the 'dates' object
      }
    
      if (!player.dates[date]) { // Check if the date key exists
        player.dates[date] = {}; 
      }


    
      player.dates[date][gameName] = { 
        text: formatted // Assuming you meant 'text' instead of 'test'
      };

      if(comment != '') {
        player.dates[date][gameName].comment = comment;
      } else {
        player.dates[date][gameName].comment = '';
      }
    

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