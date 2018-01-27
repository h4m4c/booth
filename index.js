var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var SerialPort = require('serialport');

var port = new SerialPort('/dev/cu.usbmodem1421', {
  baudRate: 9600
});

const clients = []

let start;
let running = false;

port.on('data', function (data) {
  console.log(data.toString())
  if (data == 0) {
    const diff = new Date().getTime() - start;
    let event = 'click';
    if (diff > 1000) {
      if (!running) {
        event = 'start';
        running = true;
      } else {
        event = 'stop';
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

io.on('connection', function (socket) {
  if (!running) {
    socket.emit('stop');
  } else {
    socket.emit('start');
  }
  clients.push(socket)
  // socket.emit('request', /* */); // emit an event to the socket
  // io.emit('broadcast', /* */); // emit an event to all connected sockets
  socket.on('reply', function(){ /* */ }); // listen to the event
});

app.use(express.static('static'));

server.listen(3000);
