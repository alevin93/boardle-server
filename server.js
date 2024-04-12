const express = require('express');
const corsOptions = require('./corsOptions');
const port = 4000;
const cors = require('cors');
const connectDB = require('./db');


const app = express();
app.use(cors(corsOptions));
app.use(express.json());
//connectDB();

app.post('/submit', (req, res) => {
  handleSubmission(req.body.data)
  res.sendStatus(200);
})
  
app.post('/createUser', (req, res) => {
  console.log("Create new user has been run")
  res.json(JSON.stringify([ "FUCK ME IN THE ASS" ]))
})

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`)
})



const handleSubmission = async (data) => {
  console.log(data)
}