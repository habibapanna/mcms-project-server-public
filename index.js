const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z1fic.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run () {
  try {
  // await client.connect();
  // Collections
  const campsCollection = client.db("medicalCamp").collection("camps");
  const participantsCollection = client.db("medicalCamp").collection("participants");
  const feedbackCollection = client.db("medicalCamp").collection("feedback");
  const usersCollection = client.db("medicalCamp").collection("users");
  const paymentsCollection = client.db("medicalCamp").collection("payments");


// Generate JWT token
app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user,
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '1h' }
  );
  res.send({ token });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(403).send({ message: 'Access Denied' });
  }
  const token = req.headers.authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'Invalid Token' });
    req.user = decoded;
    next();
  });
};

// Add user role
app.post('/users', async (req, res) => {
  try {
    const newUser = req.body;
    const query = { email: newUser.email };
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
      return res.send({ message: 'User already exists', insertedId: null });
    }

    // Assign 'Participant' role by default
    newUser.role = newUser.role || 'Participant';

    const result = await usersCollection.insertOne(newUser);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Internal server error' });
  }
});

app.get('/users', verifyToken, async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching users' });
  }
});

app.get('/users/organizer/:email', async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  if (user?.role === 'organizer') {
    res.send({ organizer: true });
  } else {
    res.send({ organizer: false });
  }
});

app.get('/users/organizer-profile/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const user = await usersCollection.findOne({ email });
    if (user && user.role === 'organizer') {
      const { name, photo, contact } = user;
      res.send({ name, photo, contact });
    } else {
      res.status(404).send({ message: 'Organizer not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error fetching organizer profile' });
  }
});

app.patch('/users/organizer-profile/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { name, photo, contact } = req.body;

  try {
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        name: name || undefined,
        photo: photo || undefined,
        contact: contact || undefined,
      },
    };

    const result = await usersCollection.updateOne(filter, updatedDoc);
    if (result.modifiedCount === 1) {
      res.send({ message: 'Profile updated successfully' });
    } else {
      res.status(400).send({ message: 'No changes detected or organizer not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error updating organizer profile' });
  }
});

app.patch('/users/organizer/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      role: 'organizer'
    }
  }
  const result = await usersCollection.updateOne(filter, updatedDoc);
  res.send(result);
})

// Delete a user by ID
app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };

  try {
    const result = await usersCollection.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
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

app.get('/camps', async (req, res) => {
  const result = await campsCollection.find().toArray();
  res.send(result);
})

// delete camp
app.delete('/camps/:id', async (req, res) => {
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

app.get('/participants', async (req, res) => {
  const result = await participantsCollection.find().toArray();
  res.send(result);
})

app.get('/participants/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const participant = await participantsCollection.findOne({ email });
    if (participant) {
      res.send(participant);
    } else {
      res.status(404).send({ message: 'Participant not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Error fetching participant', error });
  }
});

app.put('/participants/:email', async (req, res) => {
  const email = req.params.email;
  const updatedInfo = req.body;
  try {
    const result = await participantsCollection.updateOne(
      { email },
      { $set: updatedInfo }
    );
    if (result.modifiedCount > 0) {
      res.send({ message: 'Profile updated successfully' });
    } else {
      res.status(404).send({ message: 'Participant not found' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Error updating profile', error });
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

// Route to update a camp
app.put('/camps/:id', async (req, res) => {
  console.log('Request body:', req.body); // Log the body to ensure it's correct
  const updatedCamp = { ...req.body }; // Create a shallow copy of the request body
  const campId = req.params.id;

  // Remove the _id field from the update data
  delete updatedCamp._id;

  try {
    // Validate if the provided ID is a valid ObjectId
    if (!ObjectId.isValid(campId)) {
      return res.status(400).json({ message: 'Invalid camp ID format' });
    }

    // Proceed with the update logic
    const result = await campsCollection.updateOne(
      { _id: new ObjectId(campId) }, // Find camp by ID
      { $set: updatedCamp }, // Update the camp (excluding _id)
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    res.json({ message: 'Camp updated successfully', updatedCamp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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

app.get('/api/participants/:email', async (req, res) => {
  try {
    const email = req.params.email;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const participants = await participantsCollection.find({ email }).toArray();
    if (!participants.length) {
      return res.status(404).json({ error: 'No participants found' });
    }

    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/participants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const participant = await db.collection('participantsCollection').findOne({ _id: new ObjectId(id) });

    if (participant.paymentStatus === 'Paid') {
      return res.status(400).json({ message: 'Cannot cancel a paid registration' });
    }

    await db.collection('participantsCollection').deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: 'Registration canceled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error canceling registration', error });
  }
});
// feedback
app.post("/feedback", async (req, res) => {
  const { campId, feedbackText, rating } = req.body;

  // Check if all required fields are present
  if (!campId || !feedbackText || !rating) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    // Save feedback to the database using MongoDB driver
    const newFeedback = {
      campId,
      feedbackText,
      rating,
      createdAt: new Date(),
    };

    const result = await feedbackCollection.insertOne(newFeedback);

    res.status(201).json({ message: "Feedback submitted successfully!", feedbackId: result.insertedId });
  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ message: "Failed to submit feedback!" });
  }
});

app.get("/feedback", async (req, res) => {
  try {
    const feedbacks = await feedbackCollection.find({}).toArray();
    res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "An error occurred while fetching feedback." });
  }
});

// Backend route for canceling a registration
app.delete("/cancel-registration/:campId", async (req, res) => {
  const { campId } = req.params;

  try {
    const result = await campCollection.updateOne(
      { _id: new ObjectId(campId) },
      { $set: { registrationStatus: "Cancelled" } }
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Registration canceled successfully!" });
    } else {
      res.status(404).json({ error: "Camp not found or already canceled." });
    }
  } catch (error) {
    console.error("Error canceling registration:", error);
    res.status(500).json({ error: "Failed to cancel registration." });
  }
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;

  if (!price || isNaN(price)) {
    return res.status(400).send({ error: 'Invalid price. Please provide a valid number.' });
  }

  const amount = parseInt(price * 100);
  console.log(amount, 'amount inside the intent');
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post('/api/participants/payment-success', async (req, res) => {
  const { participantEmail, campId, transactionId, amountPaid } = req.body;

  if (!participantEmail || !campId || !transactionId || !amountPaid) {
    return res.status(400).send({ error: 'Missing required payment information.' });
  }

  try {
    // Find the participant and update their payment status
    const updateResult = await participantsCollection.updateOne(
      { email: participantEmail, _id: campId },
      {
        $set: {
          paymentStatus: 'Paid',
          transactionId,
          paymentDate: new Date(),
          amountPaid,
        },
      }
    );

    if (updateResult.modifiedCount > 0) {
      res.status(200).send({ message: 'Payment details updated successfully' });
    } else {
      res.status(404).send({ error: 'Participant or camp not found' });
    }
  } catch (error) {
    console.error('Error updating payment details:', error);
    res.status(500).send({ error: 'Error updating payment details' });
  }
});


app.get('/api/participants/payment-history', async (req, res) => {
  const { participantEmail } = req.query;

  try {
    const paymentHistory = await participantsCollection
      .find({ email: participantEmail, paymentStatus: 'Paid' })
      .project({ campName: 1, campFees: 1, paymentStatus: 1, confirmationStatus: 1, transactionId: 1, paymentDate: 1 })
      .toArray();

    res.status(200).json(paymentHistory);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Error fetching payment history', error: error.message });
  }
});

app.post('/payments', async(req, res)=>{
  const payment = req.body;
  const paymentResult = await paymentsCollection.insertOne(payment);
  console.log('payment info', payment);
  res.send(paymentResult);
});

app.get('/payments', async (req, res) => {
  try {
    const payments = await paymentsCollection.find().toArray(); // Get all payments
    console.log('Payments fetched:', payments);  // Log the fetched payments to verify
    res.json(payments);
  } catch (error) {
    console.error("Error retrieving payment history:", error);
    res.status(500).send("Failed to retrieve payment history.");
  }
});

app.patch('/payments/:id', async (req, res) => {
  const { id } = req.params;
  const { confirmationStatus } = req.body;
  try {
    const result = await paymentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { confirmationStatus } }
    );
    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update confirmation status.' });
  }
});

app.delete('/payments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await paymentsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to cancel registration.' });
  }
});
  
// await client.db("admin").command({ ping: 1 });
// console.log("Pinged your deployment. You successfully connected to MongoDB!");
} finally {
// await client.close()
}

}

// Call the function to establish a connection
run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Medical Camp Management System (MCMS) is running');
});
// Start the server
app.listen(port, () => {
  console.log(`Medical Camp Management System (MCMS) is running on port  ${port}`);
});
