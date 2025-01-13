const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Medical Camp Management System (MCMS) is running')
})

app.listen(port, () => {
    console.log(`Medical Camp Management System (MCMS) is running on port  ${port} `);
})
