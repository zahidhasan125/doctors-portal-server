const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

require('dotenv').config();

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.voxvdqi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentOptionsCollections = client.db('doctorsPortal').collection('appointmentOptions');
        const bookingsCollections = client.db('doctorsPortal').collection('bookingsCollections');

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const bookingQuery = { appointmentDate: date}
            const options = await appointmentOptionsCollections.find(query).toArray();
            const alreadyBooked = await bookingsCollections.find(bookingQuery).toArray();
            // for finding remaining slots, 1. we have to search in all the appointmentOptions with map/forEach & can get each option
            options.forEach(option => {
                // 2. booked options will be found in bookingCollection with date query, filter each booking treatment with matching with option name
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                // 3. to find all the booked slot, we have to map optionBooked for each booking slot
                const bookedSlot = optionBooked.map(book => book.slot);
                // 4. to find remaining slots we have to filter each options slot, which not includes in bookedSlot
                const remainingSlots = option.slots.filter(slot => !bookedSlot.includes(slot));
                // 5. set remainingSlots for each option slots
                option.slots = remainingSlots;
            })
            res.send(options);
        })

        app.get('/booking', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const bookings = await bookingsCollections.find(query).toArray();
            res.send(bookings)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment,
                email: booking.email
            }
            const alreadyBooked = await bookingsCollections.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You already have a appointment on ${booking.appointmentDate}`;
                return res.send({ acknowledged: false, message})
            }
            const result = await bookingsCollections.insertOne(booking);
            res.send(result);
        })
    } 
    finally{
        
    }
}

run().catch(console.log)


app.get('/', async (req, res) => {
    res.send('Doctors Portal is running.')
})

app.listen(port,()=>console.log(`Server running on ${port}`))