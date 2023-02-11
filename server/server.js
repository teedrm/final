require('dotenv').config()

const express = require("express");
const cors = require("cors");
const app = express();
const { Server } = require("socket.io");
const userQueries = require('./db/queries/users');

//setting up cookie
const cookieSession = require('cookie-session');
const session = cookieSession({ name: 'session', keys: ["secret"], sameSite: true });

app.use(express.static("public"));
app.use(express.json());
app.use(session);
app.use(cors());


app.get("/home", (req, res) => {
  res.json({ "users": [1, 2, 3] });
});

// Login: save user to session
app.post("/login", (req, res) => {
  const name = req.body.email;
  //why do we need an id? if it would always be 1
  const user = { id: 1, name };
  req.session.user = user;
  res.json(user);
});


//testing

app.post("/signup", (req, res) => {
  const data = req.body;
  userQueries.createNewUser(data)
    .then(r => {
      // res.cookie("user", generateRandomString(), {
      //   maxAge: 1000 * 60 * 60 * 24, // 1 day
      //   httpOnly: true,
      //   sameSite: 'strict',
      //   secure: true
      // } )
      req.session.token = generateRandomString()
      res.json({ "message": "successfully created user" });
    })
});

//listening to socket connection

const http = app.listen(8000, () => {
  console.log(`Server is running on port 8000.`);
});

const io = new Server(http);
const clients = {};
const users = [];
// Allow socket.io to access session
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(session));

io.on('connection', client => {
  const session = client.request.session;
  const name = session?.user?.name;

  console.log("Client Connected!", name, " : ", client.id);
  client.emit("system", `Welcome ${name}`);
  // client.broadcast.emit('system', `${name} has just joined`);

  // Add this client.id to our clients lookup object
  clients[name] = client.id;
  console.log(clients);

  client.on('join_room', data => {
    client.join(data);
    console.log('joined room ',data);
    users.push({id: client.id, room: data});
  })

  console.log('users',users);

  client.on('message', data => {
    console.log(data);
    const { text, to } = data;
    const from = name;

    if (!to) {
      const user = users.find((user) => user.id === client.id);
      client.broadcast.to(user.room).emit('public', { text, from });
      client.emit('public', { text, from });

      return;
    }

    const id = clients[to];
    console.log(`Sending message to ${to}:${id}`);
    io.to(id).emit("private", { text, from });
  });

  client.on("disconnect", () => {
    console.log("Client Disconnected", name, " : ", client.id);
    client.broadcast.emit('system', `${name} has just left`);
    delete clients[name];
  });

})
