const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:5000";

const alice = io(SERVER_URL);
const bob = io(SERVER_URL);

let aliceOnlineUsers = {};
let bobOnlineUsers = {};

const aliceName = "Alice_test";
const bobName = "Bob_test";

console.log("Connecting Alice and Bob to LOCALHOST...");

alice.on("connect", () => {
  console.log("Alice connected. ID:", alice.id);
  alice.emit("join", aliceName);
});

bob.on("connect", () => {
  console.log("Bob connected. ID:", bob.id);
  bob.emit("join", bobName);
});

alice.on("onlineUsers", (users) => {
  console.log(`Alice received onlineUsers: ${Object.keys(users).length} users`);
  aliceOnlineUsers = users;
  checkAndChat();
});

bob.on("onlineUsers", (users) => {
  console.log(`Bob received onlineUsers: ${Object.keys(users).length} users`);
  bobOnlineUsers = users;
  checkAndChat();
});

bob.on("privateMessage", (msg) => {
  console.log("✅ BOB RECEIVED PRIVATE MESSAGE:", msg);
  console.log("Bob replying to Alice...");
  bob.emit("privateMessage", {
    to: msg.fromId,
    text: "Hello Alice, I got your message!"
  });
});

alice.on("privateMessage", (msg) => {
  console.log("✅ ALICE RECEIVED PRIVATE MESSAGE:", msg);
  console.log("Test completely successful!");
  process.exit(0);
});

let chatStarted = false;
function checkAndChat() {
  if (chatStarted) return;
  
  const aliceData = Object.values(aliceOnlineUsers).find(u => u.username === aliceName);
  const bobData = Object.values(aliceOnlineUsers).find(u => u.username === bobName);
  
  if (aliceData && bobData) {
    chatStarted = true;
    console.log(`Both are online! Alice ID: ${aliceData.id}, Bob ID: ${bobData.id}`);
    
    console.log("Alice sending private message to Bob...");
    alice.emit("privateMessage", {
      to: bobData.id,
      text: "Hi Bob, this is a secret test message!"
    });
    
    setTimeout(() => {
      console.error("❌ Test timed out! Private message was not received.");
      process.exit(1);
    }, 5000);
  }
}
