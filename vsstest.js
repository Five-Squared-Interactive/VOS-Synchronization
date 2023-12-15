const { argv } = require("process");
const { v4: uuidv4 } = require('uuid');
const prompt = require("prompt-sync")({
    history: require("prompt-sync-history")()
});
const fs = require("fs");
const VOSSynchronizationService = require("./vossynchronizationservice.js");

configFilePath = "";
if (argv.length > 4) {
    configFilePath = argv[4];
}

vss = new VOSSynchronizationService();
vss.RunMQTT(argv[2], argv[3]);
vss.ConnectToMQTT(argv[2]);

if (configFilePath) {
    config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    for (session in config["sessions"]) {
        vss.CreateSession(config["sessions"][session], session);
    }
}

if (process.platform === "win32") {
    var rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    rl.on("SIGINT", function () {
      process.emit("SIGINT");
    });
}

process.on('SIGINT', function() {
    vss.StopMQTT();
    process.exit();
});

function ProcessCommand(command) {
    if (command == "quit") {
        process.emit("SIGINT");
    } else if (command.startsWith("create session")) {
        tokens = command.replace("create session ", "").split(" ");
        if (tokens.length != 1) {
            console.log("Invalid parameters. Session Tag required.");
        } else {
            id = uuidv4();
            vss.CreateSession(id, tokens[0]);
        }
    } else if (command.startsWith("delete session")) {
        tokens = command.replace("delete session ", "").split(" ");
        if (tokens.length != 1) {
            console.log("Invalid parameters. Session Key required.");
        } else {
            vss.DeleteSession(tokens[0]);
        }
    } else if (command == "get sessions") {
        sessionInfos = vss.GetSessions();
        console.log(sessionInfos);
    } else if (command.startsWith("get sessioninfo")) {
        tokens = command.replace("get sessioninfo ", "").split(" ");
        if (tokens.length != 1) {
            console.log("Invalid parameters. Session Key required.");
        } else {
            sessionInfo = vss.GetSession(tokens[0]);
            console.log(sessionInfo);
        }
    }
}

buffer = "";
console.log("VOS Synchronization Service");
console.log("Test Program");
console.log(`VSS Version ${vss.VERSION}`);
process.stdout.write(">> ");
process.stdin.on("data", function (data) {
    if (data == "\r" || data == "\n" || data == "\r\n") {
        text = buffer.toString();
        buffer = "";
        if (text != "") {
            ProcessCommand(text);
        }
        process.stdout.write(">> ");
    } else if (data == "\b") {
        if (buffer.length > 0) {
            buffer = buffer.substring(0, buffer.length - 1);
        }
    } else {
        buffer = buffer + data;
    }
});