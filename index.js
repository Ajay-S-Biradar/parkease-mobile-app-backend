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
app.put('/api/update-parking-lot', async (req, res) => {
    const { name, location, latitude, longitude, totalSlots, filledSlots, freeSlots } = req.body;

    try {
        // Check if a parking lot with the same name already exists
        let parkingLot = await prisma.parkingLot.findFirst({
            where: { name },
            include: { slots: true },
        });

        if (!parkingLot) {
            // Create a new parking lot if it doesn't exist
            if (!name || !location || !latitude || !longitude || !totalSlots || !Array.isArray(filledSlots) || !Array.isArray(freeSlots)) {
                return res.status(400).json({
                    message: 'Invalid request. Ensure name, location, latitude, longitude, totalSlots, filledSlots, and freeSlots are provided.',
                });
            }
            parkingLot = await prisma.parkingLot.create({
                data: {
                    name,
                    location,
                    latitude,
                    longitude,
                    totalSlots,
                    slots: {
                        create: Array.from({ length: totalSlots }, (_, index) => ({
                            slotNumber: index + 1,
                            status: filledSlots.includes(index + 1) ? true : false,
                        })),
                    },
                },
                include: { slots: true },
            });

            return res.status(201).json({
                message: 'Parking lot created successfully.',
                parkingLot,
            });
        }

        // Update existing parking lot
        const updatedSlots = parkingLot.slots.map((slot) => {
            if (filledSlots.includes(slot.slotNumber)) {
                slot.status = true; // Mark as filled
            } else if (freeSlots.includes(slot.slotNumber)) {
                slot.status = false; // Mark as free
            }
            return slot;
        });

        // Update slots in the parking lot
        await prisma.parkingLot.update({
            where: { id: parkingLot.id },
            data: {
                slots: {
                    updateMany: updatedSlots.map((slot) => ({
                        where: { id: slot.id },
                        data: { status: slot.status },
                    })),
                },
            },
        });

        res.status(200).json({
            message: 'Parking lot and slot statuses updated successfully.',
            parkingLot: {
                ...parkingLot,
                slots: updatedSlots,
            },
        });
    } catch (error) {
        console.error('Error updating parking lot:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Start the Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
