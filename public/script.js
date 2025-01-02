const socket = io();

// Update map with bot locations
socket.on('updateLocations', (locations) => {
    console.log('Updating bot locations:', locations);
    // TODO: Update the map with the new bot locations
});

function joinBotRoom(botName) {
    socket.emit('join', botName);

    const chatContainer = document.getElementById('chat');
    socket.off('chat'); // Remove any existing 'chat' event listeners
    socket.on('chat', (data) => {
        if (data.botName === botName) { // Ensure the message belongs to the correct bot
            const message = document.createElement('p');
            message.textContent = `${data.username}: ${data.message}`;
            chatContainer.appendChild(message);
            chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to latest message
        }
    });
}