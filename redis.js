const redis = require('redis');
const client = redis.createClient();
const { promisify } = require('util');

const getFromRedis = promisify(client.get).bind(client);
const setToRedis = promisify(client.set).bind(client);
const setExToRedis = promisify(client.setex).bind(client);
const hmGetFromRedis = promisify(client.hmget).bind(client);
const hmSetToRedis = promisify(client.hmset).bind(client);
const hGetAllFromRedis = promisify(client.hgetall).bind(client);

const notifyExpiredKey = callback => {
    client.send_command(
        'config',
        ['set', 'notify-keyspace-events', 'Ex'],
        subscribeExpired
    );

    function subscribeExpired(e, r) {
        const sub = redis.createClient();
        const expiredSubKey = '__keyevent@0__:expired';
        sub.subscribe(expiredSubKey, function () {
            sub.on('message', async function (_chan, key) {
                callback(key);
            });
        });
    }
};

module.exports = {
    client,
    getFromRedis,
    setToRedis,
    hmGetFromRedis,
    hmSetToRedis,
    hGetAllFromRedis,
    setExToRedis,
    notifyExpiredKey,
};
