const express = require('express');
const app = express();
const cors = require('cors');
// const jwt = require('jsonwebtoken');
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
const feedbackCollection = client.db("medicalCamp").collection("feedback");
const usersCollection = client.db("medicalCamp").collection("users");

// app.post('/jwt', async(req, res) =>{
//   const user = req.body;
//   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
//   res.send({ token });
// })

// const verifyToken = (req, res, next) => {

// }

// Call the function to establish a connection
connectDB().catch(console.dir);

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Medical Camp Management System (MCMS) is running');
});

app.post("/users", async (req, res) => {
  try {
      const newUser = req.body;
      console.log("Received new user:", newUser); // Debug log

      const query = { email: newUser.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
          console.log("User already exists:", existingUser); // Debug log
          return res.send({ message: "user already exists", insertedId: null });
      }

      const result = await usersCollection.insertOne(newUser);
      console.log("New user inserted:", result); // Debug log
      res.send(result);
  } catch (error) {
      console.error("Error in /users endpoint:", error);
      res.status(500).send({ message: "Internal server error" });
  }
});

// Route to add a new camp
app.post('/add-camp', async (req, res) => {
  try {
    const {
      campName,
      image,
      campFees,
      dateTime,
      location,
      healthcareProfessional,
      description,
    } = req.body;

    // Validate required fields
    if (
      !campName ||
      !image ||
      !campFees ||
      !dateTime ||
      !location ||
      !healthcareProfessional ||
      !description
    ) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Create a new camp object
    const newCamp = {
      campName,
      image,
      campFees: parseFloat(campFees), // Ensure camp fees are stored as a number
      dateTime: new Date(dateTime), // Convert dateTime to a Date object
      location,
      healthcareProfessional,
      participantCount: 0, // Default participant count is 0
      description,
      createdAt: new Date(), // Timestamp for when the camp is created
    };

    // Insert the new camp into the database
    const result = await campsCollection.insertOne(newCamp);

    res.status(201).json({
      message: 'Camp added successfully!',
      campId: result.insertedId,
    });
  } catch (err) {
    console.error('Error adding camp:', err);
    res.status(500).json({ message: 'An error occurred while adding the camp.', error: err.message });
  }
});

app.get('/camps', async(req, res) =>{
  const result = await campsCollection.find().toArray();
  res.send(result);
})

// delete camp
app.delete('/camps/:id', async(req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await campsCollection.deleteOne(query);
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

app.get('/registered-camps/:email', async (req, res) => {
  try {
    const participants = await participantsCollection.find().toArray();
    res.json(participants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching registered camps', error: error.message });
  }
});

app.post('/participants', async (req, res) => {
  try {
    const participant = req.body; // Get participant data from request body

    // Save the participant to the database
    const result = await participantsCollection.insertOne(participant);

    // Update the participant count in the corresponding camp
    await campsCollection.updateOne(
      { _id: new ObjectId(participant.campId) },
      { $inc: { participantCount: 1 } }
    );

    res.status(201).json({ message: 'Registration successful', participantId: result.insertedId });
  } catch (err) {
    console.error("Error in /participants endpoint:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/participants', async(req, res) =>{
  const result = await participantsCollection.find().toArray();
  res.send(result);
})

// Route to update participant profile
app.put('/participants/:id', async (req, res) => {
  const participantId = req.params.id;
  const updatedInfo = req.body;

  try {
    // Validate the participant ID
    if (!ObjectId.isValid(participantId)) {
      return res.status(400).json({ message: 'Invalid participant ID format' });
    }

    // Update the participant information in the database
    const result = await participantsCollection.updateOne(
      { _id: new ObjectId(participantId) },
      { $set: updatedInfo }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ message: 'Participant not found or no changes made' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

app.put('/confirm-registration/:id', async (req, res) => {
  const participantId = req.params.id;

  try {
    const result = await participantsCollection.updateOne(
      { _id: new ObjectId(participantId) },
      { $set: { confirmationStatus: 'Confirmed' } }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: 'Registration confirmed successfully' });
    } else {
      res.status(404).json({ message: 'Participant not found or already confirmed' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error confirming registration', error: error.message });
  }
});

app.delete('/cancel-registration/:id', async (req, res) => {
  const participantId = req.params.id;

  try {
    const participant = await participantsCollection.findOne({ _id: new ObjectId(participantId) });

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Check if the participant can be canceled
    if (participant.paymentStatus === 'Paid' && participant.confirmationStatus === 'Confirmed') {
      return res.status(400).json({ message: 'Cannot cancel a confirmed and paid registration' });
    }

    // Remove participant from the collection
    const result = await participantsCollection.deleteOne({ _id: new ObjectId(participantId) });

    if (result.deletedCount > 0) {
      // Decrement the participant count in the corresponding camp
      await campsCollection.updateOne(
        { _id: new ObjectId(participant.campId) },
        { $inc: { participantCount: -1 } }
      );

      res.json({ message: 'Registration canceled successfully' });
    } else {
      res.status(404).json({ message: 'Error canceling registration' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error canceling registration', error: error.message });
  }
});

const addFeedback = async (campId, participantId, rating, feedbackText) => {
  const feedback = {
    campId,
    participantId,
    rating,
    feedbackText,
    date: new Date(),
  };

  try {
    const result = await feedbackCollection.insertOne(feedback);
    console.log('Feedback added:', result);
  } catch (error) {
    console.error('Error adding feedback:', error);
  }
};

app.post('/submit-feedback', async (req, res) => {
  const { campId, participantId, rating, feedbackText } = req.body;

  try {
    await addFeedback(campId, participantId, rating, feedbackText);
    res.json({ message: 'Feedback submitted successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting feedback', error: err.message });
  }
});

app.get('/upcoming-camps', async (req, res) => {
  try {
    const upcomingCamps = await campsCollection.find({ date: { $gte: new Date() } }).toArray();
    res.json(upcomingCamps);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching upcoming camps', error: err.message });
  }
});

app.put('/update-camp/:campId', async (req, res) => {
  const { campId } = req.params;
  const updatedDetails = req.body;

  try {
    const result = await campsCollection.updateOne(
      { _id: new ObjectId(campId) },
      { $set: updatedDetails }
    );
    if (result.modifiedCount > 0) {
      res.json({ message: 'Camp updated successfully' });
    } else {
      res.status(404).json({ message: 'Camp not found or no changes made' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating camp', error: error.message });
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
