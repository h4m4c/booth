var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var SerialPort = require("serialport");
var mime = require("mime");
var formidable = require("formidable");
var util = require("util");
var fs = require("fs");
var { resolve } = require("path");
var config = require("./config");

var port = new SerialPort("/dev/ttyACM0", {
  baudRate: 9600
});

function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

const clients = [];

let ts;
let start;
let running = false;
let fd;
var i = 0;
var questions = [];

port.on("data", function(data) {
  if (data == 0) {
    const diff = new Date().getTime() - ts;
    if (diff > 1000) {
      if (!running) {
        running = true;
        start = new Date();
        fd = fs.openSync(
          "./uploads/" + Math.floor(start.getTime() / 1000) + ".txt",
          "w+"
        );

        i = 0;
        questions = config.primary.concat(shuffle(config.random));
        questions.push(config.end);

        q = questions[Math.min(i, questions.length - 1)];
        fs.writeSync(
          fd,
          Math.floor(start.getTime() / 1000) +
            " | " +
            start.toUTCString() +
            " - " +
            q +
            "\n"
        );

        clients.forEach(c => {
          c.emit("start", { ts: Math.floor(start.getTime() / 1000) });
          c.emit("text", { text: q });
        });
      } else {
        running = false;
        fs.closeSync(fd);

        clients.forEach(c => {
          c.emit("stop");
          c.emit("text", { text: config.start });
        });
      }
    } else if (running) {
      i++;
      q = questions[Math.min(i, questions.length - 1)];
      t = new Date();
      fs.writeSync(
        fd,
        Math.floor(t.getTime() / 1000) +
          " | " +
          t.toUTCString() +
          " - " +
          q +
          "\n"
      );

      clients.forEach(c => {
        c.emit("text", { text: q });
      });
    }
  }
  if (data == 1) {
    ts = new Date().getTime();
  }
});

io.on("connection", function(socket) {
  if (!running) {
    socket.emit("stop");
    socket.emit("text", { text: config.start });
  } else {
    socket.emit("start", { ts: Math.floor(start.getTime() / 1000) });
    socket.emit("text", { text: questions[Math.min(i, questions.length - 1)] });
  }
  clients.push(socket);
  // socket.emit('request', /* */); // emit an event to the socket
  // io.emit('broadcast', /* */); // emit an event to all connected sockets
  socket.on("reply", function() {
    /* */
  }); // listen to the event
});

app.use(express.static("static"));
app.get("/uploads/:file", function(req, res) {
  return res.sendFile(req.params.file, {
    root: resolve(__dirname, "uploads")
  });
});

app.post("/upload", function uploadFile(request, response) {
  // parse a file upload
  var form = new formidable.IncomingForm();

  var dir = !!process.platform.match(/^win/) ? "\\uploads\\" : "/uploads/";

  form.uploadDir = __dirname + dir;
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;

  form.parse(request, function(err, fields, files) {
    var file = util.inspect(files);
    var addr = app.address;

    response.writeHead(200, getHeaders("Content-Type", "application/json"));

    var fileName = file
      .split("path:")[1]
      .split("',")[0]
      .split(dir)[1]
      .toString()
      .replace(/\\/g, "")
      .replace(/\//g, "");

    fs.rename(
      files.file.path,
      __dirname + "/uploads/" + files.file.name,
      err => {
        if (err) {
          response.end();
          return console.error(err);
        }

        var fileURL = `http://127.0.0.1:3000/uploads/` + fileName;

        console.log("fileURL: ", fileURL);
        response.write(
          JSON.stringify({
            fileURL: fileURL
          })
        );
        response.end();
      }
    );
  });
});

function getHeaders(opt, val) {
  try {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "https://secure.seedocnow.com";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = true;
    headers["Access-Control-Max-Age"] = "86400"; // 24 hours
    headers["Access-Control-Allow-Headers"] =
      "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";

    if (opt) {
      headers[opt] = val;
    }

    return headers;
  } catch (e) {
    return {};
  }
}

server.listen(3000);
