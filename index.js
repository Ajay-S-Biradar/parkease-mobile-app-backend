import express from "express";
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import cors from 'cors';
import calculateDistanceInKM from './calculateDistanceInKM.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Server is running successfully on Render!');
});

app.get('/api/parking-lots', async (req, res) => {
    try {
        const parkingLots = await prisma.parkingLot.findMany({
            include: {
                slots: true,
            },
        });

        res.json(parkingLots);  // Return the data as JSON
    } catch (error) {
        console.error('Error fetching ParkingLot data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/nearby-parking-lots', async (req, res) => {
    const { userLat, userLon } = req.body;

    console.log("User Latitude:", userLat)
    console.log("User Longitude:", userLon)

    if (!userLat || !userLon) {
        return res.status(400).json({ message: 'User location (latitude, longitude) is required' });
    }

    try {
        const parkingLots = await prisma.parkingLot.findMany();

        const nearbyParkingLots = parkingLots.filter(lot => {
            const distance = calculateDistanceInKM(userLat, userLon, lot.latitude, lot.longitude);
            return distance <= 10;
        });

        res.json(nearbyParkingLots);
    } catch (error) {
        console.error('Error fetching nearby parking lots:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/lot-details', async (req, res) => {
    const { parkingLotName, userLat, userLon } = req.body;

    try {
        // Query the ParkingLot by name (using findFirst)
        const parkingLot = await prisma.parkingLot.findFirst({
            where: {
                name: parkingLotName,
            },
            include: {
                slots: true,
            },
        });

        if (!parkingLot) {
            return res.status(404).json({ message: 'Parking lot not found' });
        }

        const distance = calculateDistanceInKM(
            userLat,
            userLon,
            parkingLot.latitude,
            parkingLot.longitude
        );

        // Count total slots and filled/available slots
        const totalSlots = parkingLot.totalSlots;
        const filledSlots = parkingLot.slots.filter(slot => !slot.status).length;
        const availableSlots = totalSlots - filledSlots;

        // Prepare response data
        const responseData = {
            parkingLotName: parkingLot.name,
            latitude: parkingLot.latitude,
            longitude: parkingLot.longitude,
            distance: distance.toFixed(2),
            totalSlots,
            availableSlots,
            filledSlots,
        };

        // Send the response
        res.status(200).json(responseData);
    } catch (error) {
        console.error('Error fetching lot details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// New endpoint to update slot status
app.put('/api/update-slot-status', async (req, res) => {
    const { parkingLotId, filledSlots, freeSlots } = req.body;

    if (!parkingLotId || !Array.isArray(filledSlots) || !Array.isArray(freeSlots)) {
        return res.status(400).json({ message: 'Invalid request. Ensure parkingLotId, filledSlots, and freeSlots are provided.' });
    }

    try {
        // Find the parking lot by ID
        const parkingLot = await prisma.parkingLot.findUnique({
            where: { id: parkingLotId },
            include: { slots: true },
        });

        if (!parkingLot) {
            return res.status(404).json({ message: 'Parking lot not found' });
        }

        // Update the status of the slots based on the provided filledSlots and freeSlots
        const updatedSlots = parkingLot.slots.map(slot => {
            if (filledSlots.includes(slot.slotNumber)) {
                slot.status = true;  // Mark as filled
            } else if (freeSlots.includes(slot.slotNumber)) {
                slot.status = false;  // Mark as free
            }
            return slot;
        });

        // Update the parking lot with new slot statuses
        await prisma.parkingLot.update({
            where: { id: parkingLotId },
            data: {
                slots: {
                    updateMany: updatedSlots.map(slot => ({
                        where: { id: slot.id },
                        data: { status: slot.status },
                    })),
                },
            },
        });

        res.status(200).json({ message: 'Slot statuses updated successfully' });
    } catch (error) {
        console.error('Error updating slot status:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
