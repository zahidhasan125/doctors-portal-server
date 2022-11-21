const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

require('dotenv').config();

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.voxvdqi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized');
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        const appointmentOptionsCollections = client.db('doctorsPortal').collection('appointmentOptions');
        const bookingsCollections = client.db('doctorsPortal').collection('bookingsCollections');
        const usersCollections = client.db('doctorsPortal').collection('usersCollections');
        const doctorsCollections = client.db('doctorsPortal').collection('doctorsCollections');

        const verifyAdmin = async(req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollections.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: "Forbidden" })
            }
            next();
        }

        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const bookingQuery = { appointmentDate: date }
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

        app.get('/appointmentSpecialty', async (req, res) => {
            const query = {};
            const result = await appointmentOptionsCollections.find(query).project({ name: 1 }).toArray();
            res.send(result);
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(401).send({ message: 'Unauthorized!' })
            }
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
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollections.insertOne(booking);
            res.send(result);
        });

        // to create a crypto random 64 bytes hex string, run the following code to a node terminal
        // require('crypto').randomBytes(64).toString('hex')

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollections.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
                return res.send({ accessToken: token })
            }
            res.status(401).send({ accessToken: '' })
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollections.find(query).toArray();
            res.send(users)
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollections.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result);
        })

        app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
            

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollections.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const doctors = await doctorsCollections.find(query).toArray();
            res.send(doctors);
        })

        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollections.insertOne(doctor);
            res.send(result)
        })

        app.delete('/doctor/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await doctorsCollections.deleteOne(query);
            res.send(result)
        })
    }
    finally {

    }
}

run().catch(console.log)


app.get('/', async (req, res) => {
    res.send('Doctors Portal is running.')
})

app.listen(port, () => console.log(`Server running on ${port}`))