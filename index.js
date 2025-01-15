const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
const participantsCollection = client.db("medicalCamp").collection("participants");

// Call the function to establish a connection
connectDB().catch(console.dir);

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Medical Camp Management System (MCMS) is running');
});

app.get('/camps', async(req, res) =>{
  const result = await campsCollection.find().toArray();
  res.send(result);
})



app.get('/camps/:id', async (req, res) => {
  try {
    const campId = req.params.id;

    // Validate if the provided ID is a valid ObjectId
    if (!ObjectId.isValid(campId)) {
      return res.status(400).json({ message: 'Invalid camp ID format' });
    }

    // Convert the string ID to ObjectId
    const camp = await campsCollection.findOne({ _id: new ObjectId(campId) });

    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    res.json(camp);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching camp details', error: err.message });
  }
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
app.get('/popular-camps', async (req, res) => {
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


app.post('/register-participant', async (req, res) => {
  try {
    const participant = req.body; // Get participant data from request body

    // Check if participant already exists
    const existingParticipant = await participantsCollection.findOne({ email: participant.email });
    if (existingParticipant) {
      return res.status(400).json({ message: 'Participant already registered' });
    }

    // Save the participant to the database
    const result = await participantsCollection.insertOne(participant);

    // Update the participant count in the corresponding camp
    await campsCollection.updateOne(
      { _id: new ObjectId(participant.campId) },
      { $inc: { participantCount: 1 } }
    );

    res.status(201).json({ message: 'Registration successful', participant: result.ops[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error registering participant', error: err.message });
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
