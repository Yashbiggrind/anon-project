const { io } = require("socket.io-client");
const socket = io("http://localhost:4000", { transports: ["websocket"] });
let roomId;

socket.on("session:ready", () => {
  socket.emit("room:create", { capacity: 5, topic: "debug" }, (res) => {
    if (!res?.ok) { console.log("create failed:", res); process.exit(1); }
    roomId = res.room.roomId;
    console.log("room created:", roomId);

    socket.emit("room:set-slowmode", { roomId, seconds: 5 }, (r2) => {
      console.log("slowmode set:", r2);

      console.log("\n[1] sending msg one at", Date.now());
      socket.emit("room:message", { roomId, content: "one" }, (r3) => {
        console.log("[1] ack:", JSON.stringify(r3));

        setTimeout(() => {
          console.log("\n[2] sending msg two at", Date.now());
          socket.emit("room:message", { roomId, content: "two" }, (r4) => {
            console.log("[2] ack:", JSON.stringify(r4));

            if (r4?.ok === false && String(r4.error).includes("Slow mode")) {
              console.log("\n>>> PASS: slow mode blocked the second message");
            } else {
              console.log("\n>>> FAIL: slow mode did NOT block");
            }
            process.exit(0);
          });
        }, 500);
      });
    });
  });
});
