const express = require('express');
const bodyParser = require('body-parser');
const mineflayer = require('mineflayer');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const viewer = require('prismarine-viewer').mineflayer;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Bot storage
const bots = {}; // Store active bots
const chatMessages = {}; // Store chat messages for each bot
const botLocations = {}; // Store bot locations for mapping
const botData = {}; // Store metadata about each bot

function spawnBots(botPrefix, server, version, amount) {
    for (let i = 1; i <= amount; i++) {
        const botName = `${botPrefix}${i}`;
        const bot = mineflayer.createBot({
            host: server,
            username: botName,
            version: version, // Correctly use the version parameter
        });

        bot.on('login', () => {
            console.log(`${botName} connected to ${server} using version ${version}`);
            chatMessages[botName] = [];
            botLocations[botName] = { x: 0, y: 0, z: 0 }; // Default location
            botData[botName] = {
                name: botName,
                server: server,
                version: version,
                active: true,
            };
        });

        bot.on('chat', (username, message) => {
            console.log(`[${botName}] ${username}: ${message}`);
            if (!chatMessages[botName]) chatMessages[botName] = [];
            chatMessages[botName].push({ username, message });
        
            // Emit the message to the frontend via Socket.IO
            io.to(botName).emit('chat', { botName, username, message });
        });
        
        bot.on('move', () => {
            if (bot.entity) {
                botLocations[botName] = {
                    x: bot.entity.position.x,
                    y: bot.entity.position.y,
                    z: bot.entity.position.z,
                };
                io.emit('updateLocations', botLocations);
            }
        });

        bot.on('end', () => {
            console.log(`${botName} disconnected`);
            delete bots[botName];
            delete chatMessages[botName];
            delete botLocations[botName];
            if (botData[botName]) botData[botName].active = false;
        });

        bot.on('error', (err) => {
            console.error(`[${botName}] Error: ${err.message}`);
        });

        bots[botName] = bot;
    }
}

// Stop all bots
function stopAllBots() {
    Object.keys(bots).forEach((botName) => {
        bots[botName].end();
        delete bots[botName];
        delete chatMessages[botName];
        delete botLocations[botName];
    });
}

// Stop a specific bot
function stopBot(botName) {
    if (bots[botName]) {
        bots[botName].end();
        delete bots[botName];
        delete chatMessages[botName];
        delete botLocations[botName];
    }
}

function spawnBots(botPrefix, server, version, amount) {
    for (let i = 1; i <= amount; i++) {
        const botName = `${botPrefix}${i}`;
        const viewerPort = 3001 + i; // Unique port for each bot
        const bot = mineflayer.createBot({
            host: server,
            username: botName,
            version: version,
        });

        bot.once('spawn', () => {
            viewer(bot, { port: viewerPort });
            console.log(`${botName}'s viewer running at http://localhost:${viewerPort}`);
        });

        botData[botName] = {
            name: botName,
            server: server,
            version: version,
            active: true,
            viewerPort, // Store the viewer port
        };

        bots[botName] = bot;
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/spawn', (req, res) => {
    const { prefix, server, version, amount } = req.body;
    console.log(`Request to spawn bots: Prefix=${prefix}, Server=${server}, Version=${version}, Amount=${amount}`);
    spawnBots(prefix, server, version, parseInt(amount));
    res.redirect('/');
});

app.get('/bot/:botName', (req, res) => {
    const botName = req.params.botName;
    if (!bots[botName]) {
        res.status(404).send('<p>Bot not found</p>');
        return;
    }
    res.sendFile(path.join(__dirname, 'public', 'bot.html'));
});

app.get('/api/bots', (req, res) => {
    const botInfo = Object.keys(botData).map((botName) => ({
        name: botName,
        server: botData[botName].server, // Fetch server from botData
        version: botData[botName].version,
        active: botData[botName].active,
        viewerPort: botData[botName].viewerPort,
    }));
    res.json(botInfo);
});

app.get('/stop', (req, res) => {
    const { bot } = req.query;
    stopBot(bot);
    res.redirect('/');
});

app.post('/stop-all', (req, res) => {
    stopAllBots();
    res.redirect('/');
});

// Socket.io
io.on('connection', (socket) => {
    socket.on('join', (botName) => {
        socket.join(botName);
    });

    // Send bot locations periodically
    setInterval(() => {
        socket.emit('updateLocations', botLocations);
    }, 1000);
});

// Start the server
server.listen(PORT, () => {
    console.log(`Bot Web running at http://localhost:${PORT}`);
});
