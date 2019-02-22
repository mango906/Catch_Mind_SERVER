let express = require("express");
let app = express();
let http = require("http").createServer(app);
let io = require("socket.io")(http);
let room_id = -1;

let rooms = [];
let clients = [];
let chats = [];

let quiz = ["사과", "바나나"];

app.use(express.static("public"));
http.listen(4000, function() {
  console.log("server on!");
});

io.on("connection", socket => {
  console.log("connection : " + socket.id);

  io.emit("roomlist", rooms);

  socket.on("join", nickname => {
    let client = new Object();
    console.log("join : " + socket.id);
    client.id = socket.id;
    client.name = nickname;
    client.room_id = null;
    clients.push(client);
    socket.emit("getId", client.id);
    io.emit("users", clients);
  });

  socket.on("disconnect", () => {
    console.log(`socket '${socket.id}' disconnected!`);

    let room_id;

    clients.forEach(client => {
      if (client.id === socket.id) {
        room_id = client.room_id;
      }
    });

    clients.forEach((client, i) => {
      if (client.id === socket.id) {
        clients.splice(i, 1);
      }
    });

    rooms.forEach((room, i) => {
      let room_master = Object.keys(room.detail.sockets)[0];

      room.room_master = findName(room_master);

      console.log(`roomId : ${room.room_id} and disconnect roomId : ${room_id}`);

      if (room.room_id == room_id) {
        console.log("getRoomInfo submit");
        io.in(room_id).emit("getRoomInfo", room.detail, clients);
      }

      if (room.detail.length === 0) {
        rooms.splice(i, 1);
      }
    });

    io.emit("roomlist", rooms);
    io.emit("users", clients);
  });

  socket.on("getId", () => {
    socket.emit("getId", socket.id);
  });

  socket.on("main_chat", chatObject => {
    let chatData = {
      name: findName(chatObject.id),
      content: chatObject.content
    };
    io.emit("main_chat", chatData);
  });

  socket.on("waiting_chat", chat => {
    let chatData = {
      name: findName(chat.id),
      content: chat.content
    };
    io.emit("waiting_chat", chatData);
  });

  socket.on("createRoom", (roomName, my_id) => {
    room_id++;
    socket.join(room_id);
    clients.forEach(client => {
      if (client.id === socket.id) {
        client.room_id = room_id;
      }
    });
    let room_list = {};
    let socketRooms = io.sockets.adapter.rooms;
    Object.keys(socketRooms).map((key, index) => {
      var value = socketRooms[key];
      if (key != Object.keys(value.sockets)[0]) {
        room_list[key] = value;
      }
    });

    let lastKey = Object.keys(room_list)[Object.keys(room_list).length - 1];

    let roomMaster = findName(Object.keys(socketRooms[lastKey].sockets)[0]);

    let newRoom = new Object();
    newRoom.room_id = lastKey;
    newRoom.room_name = roomName;
    newRoom.room_master = roomMaster;
    newRoom.detail = room_list[lastKey];
    newRoom.answer = null;
    newRoom.count = 1;
    rooms.push(newRoom);

    console.log(rooms[0].detail.sockets);

    socket.emit("joinRoomSuccess", room_id);
    io.emit("roomlist", rooms);
  });

  socket.on("joinRoom", room_id => {
    console.log("joinRoom Socket " + socket.id);
    // let socketRooms = io.sockets.adapter.rooms;
    socket.join(room_id);
    console.log(rooms[0].detail.sockets);
    clients.forEach(client => {
      if (client.id === socket.id) {
        client.room_id = room_id;
      }
    });
    socket.emit("joinRoomSuccess", room_id);
    io.emit("roomlist", rooms);
  });

  socket.on("chat", chatObject => {
    let chatData = {
      name: findName(chatObject.id),
      value: chatObject.value
    };
    console.log(chatData);
    io.emit("chat", chatData);
  });

  socket.on("drawing_chat", chatObject => {
    let room_id = chatObject.room_id;
    let i = findRoom(room_id);
    if (chatObject.value == rooms[i].answer) {
      let sentence = `[${findName(socket.id)}]님이 정답을 맞추셨습니다! (정답 : ${
        rooms[i].answer
      })`;
      rooms[i].answer = "바나나";
      rooms[i].count++;
      io.to(socket.id).emit("gameInfo", "바나나", rooms[i].count);
      socket.broadcast.emit("gameInfo", "?", rooms[i].count);
      io.in(room_id).emit("correctAnswer", sentence);
      return;
    }
    let chatData = {
      name: findName(chatObject.id),
      value: chatObject.value
    };
    io.in(room_id).emit("drawing_chat", chatData);
  });

  socket.on("getRoomInfo", room_id => {
    console.log(`getRoomInfo socket : ${socket.id} & room_id : ${room_id}`);
    rooms.forEach(room => {
      if (room.room_id == room_id) {
        console.log(room);
        console.log("correct rooms");
        io.in(room_id).emit("getRoomInfo", clients);
        io.to(Object.keys(room.detail.sockets)[0]).emit("room_master", "game_start");
      }
    });
    // let room_list = {};
    // let socketRooms = io.sockets.adapter.rooms;
    // Object.keys(socketRooms).map((key, index) => {
    //   var value = socketRooms[key];
    //   if (key != Object.keys(value.sockets)[0]) {
    //     room_list[key] = value;
    //   }
    // });

    // let lastKey = Object.keys(room_list)[Object.keys(room_list).length -1];

    // let roomMaster = findName(Object.keys(socketRooms[lastKey].sockets)[0]);

    // let newRoom = new Object();
    // newRoom.room_id = lastKey;
    // // newRoom.room_name = roomName;
    // newRoom.room_master = roomMaster;
    // newRoom.detail = room_list[lastKey];
  });

  socket.on("game_start", room_id => {
    io.in(room_id).emit("game_start");
  });

  socket.on("gameInfo", room_id => {
    let i = findRoom(room_id);
    rooms[i].answer = "사과";
    io.to(Object.keys(rooms[i].detail.sockets)[0]).emit(
      "gameInfo",
      rooms[i].answer,
      rooms[i].count
    );
  });

  socket.on("initDraw", location => {
    io.emit("initDraw", location);
  });

  socket.on("Draw", location => {
    io.emit("Draw", location);
  });

  socket.on("finishDraw", () => {
    io.emit("finishDraw");
  });

  socket.on("setColor", el => {
    io.emit("setColor", el);
  });

  socket.on("setEraser", () => {
    io.emit("setEraser");
  });

  socket.on("selectWidth", e => {
    io.emit("selectWidth", e);
  });

  socket.on("canvasClear", () => {
    io.emit("canvasClear");
  });
});

function findName(id) {
  // let name = clients.filter(client =>{
  //   Object.values(client.id) === id
  // });
  let name;
  clients.forEach(client => {
    if (client.id === id) {
      name = client.name;
    }
  });
  return name;
}

function findRoom(room_id) {
  let idx;
  rooms.forEach((room, i) => {
    if (room.room_id == room_id) {
      idx = i;
    }
  });
  return idx;
}
