const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z1fic.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Connect to MongoDB and define the database
let campsCollection;
async function connectDB() {
  await client.connect();
  campsCollection = client.db("medicalCamp").collection("camps"); // "camps" collection
  console.log("MongoDB connected");
}

// Call the function to establish a connection
connectDB().catch(console.dir);

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Medical Camp Management System (MCMS) is running');
});


// Route to get all available camps
app.get('/available-camps', async (req, res) => {
  try {
    const camps = await campsCollection.find().toArray();
    res.json(camps);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching available camps', error: err.message });
  }
});


// Route to get the top 6 camps by highest participant count
app.get('/top-camps', async (req, res) => {
  try {
    const camps = await campsCollection
      .find()
      .sort({ participantCount: -1 })  // Sort by participantCount in descending order
      .limit(6)  // Limit the result to top 6
      .toArray();
    res.json(camps);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching camps', error: err.message });
  }
});

// Route to join a camp (increase participant count)
app.post('/join-camp/:campId', async (req, res) => {
  try {
    const campId = req.params.campId;
    const camp = await campsCollection.findOne({ _id: new MongoClient.ObjectId(campId) });

    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    // Update participant count
    await campsCollection.updateOne(
      { _id: new MongoClient.ObjectId(campId) },
      { $inc: { participantCount: 1 } }  // Increment participantCount by 1
    );

    res.json({ message: 'You have successfully joined the camp', updatedCamp: camp });
  } catch (err) {
    res.status(500).json({ message: 'Error joining the camp', error: err.message });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Medical Camp Management System (MCMS) is running on port  ${port}`);
});
