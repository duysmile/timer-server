const express = require('express');
const redisAdapter = require('socket.io-redis');
const app = express();
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);

io.adapter(redisAdapter('redis://localhost:6379'));
const ioEmitter = require('socket.io-emitter')('redis://localhost:6379');

const Agenda = require('agenda');
const agenda = new Agenda({
    db: {
        address: 'mongodb://localhost:27017/agenda',
    },
});

agenda.define('auto_send_message', { priority: 'high', concurrency: 10 }, async job => {
    const { socketId, message } = job.attrs.data;
    ioEmitter.to(socketId).emit('response', `[Agenda]You sent a message: ${message}`);
});



const { notifyExpiredKey, setExToRedis, setToRedis, getFromRedis } = require('./redis');

app.get('/', (req, res) => {
    res.sendFile(path.resolve('.', 'index.html'));
});

const timers = {};

io.on('connection', socket => {
    console.log('A user is connected');
    socket.on('message', async (message, cb) => {
        cb(message);

        // handle with setTimeout
        const timer = delayResponse(5000, socket, message);
        const socketId = socket.id;
        if (timers[socketId]) {
            clearTimeout(timers[socketId]);
        }
        timers[socketId] = timer;

        // handle with redis
        setExToRedis(socketId, 5, true);
        setToRedis(`message_${socketId}`, message);

        // handle with agenda
        try {
            const job = await agenda.jobs({
                'data.socketId': socketId,
                name: 'auto_send_message',
            });
            if (job.length > 0) {
                await job[0].remove();
            }
            await agenda.schedule('in 5 seconds', 'auto_send_message', {
                socketId,
                message,
            });
        } catch (error) {
            console.error(error);
        }
    });
});

notifyExpiredKey(async (socketId) => {
    const message = await getFromRedis(`message_${socketId}`);
    ioEmitter.to(socketId).emit('response', `[Redis]You sent a message: ${message}`);
});

function delayResponse(time, socket, message) {
    return setTimeout(() => {
        // handle message here
        socket.emit('response', `[Timeout]You sent a message: ${message}`);
    }, time);
}

agenda.start().then(() => {
    http.listen(3000, () => {
        console.log('Server started at port 3000');
    });
});
