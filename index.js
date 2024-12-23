const express = require('express');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const cors = require("cors");

const app = express();
const prisma = new PrismaClient();
const port = 3000;

// Middleware to parse JSON
app.use(cors({
    origin: '*',  // Allow all origins for development purposes
}));
app.use(express.json());

// GET API endpoint to fetch all parking lot data from the database
app.get('/api/parking-lots', async (req, res) => {
    console.log("hi");
    
    try {
        const parkingLots = await prisma.parkingLot.findMany({
            include: {
                slots: true,  // Include related parking slots data
            },
        });

        res.json(parkingLots);  // Return the data as JSON
    } catch (error) {
        console.error('Error fetching ParkingLot data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
