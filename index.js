// dependences
require('dotenv').config()
const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var admin = require("firebase-admin");
var serviceAccount = require("./game-hub-firebase-adminsdk.json");

const app = express()
const port = process.env.PORT || 3000


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors())
app.use(express.json())

// custom middleware 
const verifyFBToken = async (req, res, next) => {
    const authorization = req.headers.authorization
    if(!authorization){
        return res.status(401).send({message:"unauthorize access"})
    }
    const token = authorization.split(" ")[1]
    if(!token){
        return res.status(401).send({message:"unauthorize access"})
    }
    try {
       const decode = await admin.auth().verifyIdToken(token)
       req.token_email = decode.email
    } catch {
        return res.status(401).send({message:"unauthorize access"})
    }
    next()
}

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.wfr9cox.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('gameHub')
        const gamesCollection = db.collection('games')
        const wishListCollection = db.collection('wishList')

        app.get('/games', async (req, res) => {
            const result = await gamesCollection.find().toArray()
            res.send(result)
        })
        app.get('/wish-games', verifyFBToken,async (req, res) => {
            const { email } = req.query
            if(email!==req.token_email){
                return res.status(403).send({message:"forbidden access"})
            }
            const query = {}
            if (!email) {
                return res.send({ message: 'need an email to work' })
            }
            query.email = email
            const result = await wishListCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/wish-game', async (req, res) => {
            const newGame = req.body
            if(!newGame.email){
                return res.send({message:"need an email to work"})
            }
            // check the wish list to avoid dublicate
            const query = { gameId: newGame.gameId, email: newGame.email }
            const gameExist = await wishListCollection.findOne(query)
            if (gameExist) {
                return res.send({ message: "You already Added This game to Wish List" })
            }

            const result = await wishListCollection.insertOne(newGame)
            res.send(result)
        })
        app.delete('/wish-game/:id', async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const result = await wishListCollection.deleteOne(query)
            res.send(result)
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Game Hub is On')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
