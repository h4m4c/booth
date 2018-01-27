var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var SerialPort = require("serialport");
var mime = require("mime");
var formidable = require("formidable");
var util = require("util");
var { resolve } = require("path");

var port = new SerialPort("/dev/cu.usbmodem1421", {
  baudRate: 9600
});

const clients = [];

let start;
let running = false;

port.on("data", function(data) {
  console.log(data.toString());
  if (data == 0) {
    const diff = new Date().getTime() - start;
    let event = "click";
    if (diff > 1000) {
      if (!running) {
        event = "start";
        running = true;
      } else {
        event = "stop";
        running = false;
      }
    }
    console.log(event);

    clients.forEach(c => {
      c.emit(event);
    });
  }
  if (data == 1) {
    start = new Date().getTime();
  }
});

io.on("connection", function(socket) {
  if (!running) {
    socket.emit("stop");
  } else {
    socket.emit("start");
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

    var fileURL = `http://127.0.0.1:3000/uploads/` + fileName;

    console.log("fileURL: ", fileURL);
    response.write(
      JSON.stringify({
        fileURL: fileURL
      })
    );
    response.end();
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
