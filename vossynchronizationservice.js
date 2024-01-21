// Copyright (c) 2019-2024 Five Squared Interactive. All rights reserved.

const { spawn } = require("child_process");
const mqtt = require("mqtt");
const fs = require("fs");
const { v4: uuidv4 } = require('uuid');
const vosSynchronizationSession = require('./vossynchronizationsession.js');

/**
 * Configuration File name.
 */
const CONFIGFILENAME = ".config-temp";

/**
 * @module VOSSynchronizationService VOS Synchronization Service.
 */
module.exports = function() {

    /**
     * Version.
     */
    this.VERSION = "0.0.1"

    /**
     * Client.
     */
    var client;

    /**
     * VOS Synchronization Sessions.
     */
    var vosSynchronizationSessions = {};

    /**
     * @function RunMQTT Run MQTT process.
     * @param {*} port Port.
     * @param {*} websocketsPort WebSockets Port.
     */
    this.RunMQTT = function(port, websocketsPort = 0, caFile = null, privateKeyFile = null, certFile = null) {
        var config = `listener ${port}\nprotocol mqtt`;
        if (websocketsPort > 0) {
            config = `${config}\nlistener ${websocketsPort}\nprotocol websockets`;
            if (caFile != null && privateKeyFile != null && certFile != null) {
                config = `${config}\ncafile ${caFile}\ncertfile ${certFile}\nkeyfile ${privateKeyFile}`;
            }
        }
        config = `${config}\nallow_anonymous true`;
        fs.writeFileSync(CONFIGFILENAME, config);
        if (process.platform == "win32") {
            this.mosquittoProcess = spawn(".\\Mosquitto\\mosquitto.exe", ["-c", CONFIGFILENAME], {detached: true});
        } else {
            this.mosquittoProcess = spawn("mosquitto", ["-c", CONFIGFILENAME], {detached: true});
        }
        this.mosquittoProcess.stdout.on('data', (data) => {
            Log(`[VOSSynchronizationService] ${data}`);
        });
        this.mosquittoProcess.stderr.on('data', (data) => {
            Log(`[VOSSynchronizationService] ${data}`);
        });
        this.mosquittoProcess.on('close', (code) => {
            Log(`[VOSSynchronizationService] MQTT server exited ${code}`);
        });
    }
    
    /**
     * @function StopMQTT Stop MQTT process.
     */
    this.StopMQTT = function() {
        if (this.mosquittoProcess != null)
        {
            process.kill(this.mosquittoProcess.pid);
            if (fs.existsSync(CONFIGFILENAME)) {
                fs.rmSync(CONFIGFILENAME);
            }
        }
    }
    
    /**
     * @function ConnectToMQTT Connect to MQTT server.
     * @param {*} port Port.
     */
    this.ConnectToMQTT = function(port) {
        client = mqtt.connect(`mqtt://localhost:${port}`);
        client.on('connect', function()  {
            client.subscribe("vos/#", function(err) {
                if (err) {
                    Log("[VOSSynchronizationService] Error Starting");
                } else {
                    Log("[VOSSynchronizationService] Started");
                }
            });
        });
    
        client.on('message', function(topic, message) {
            ProcessMessage(topic, message);
        });
    }

    /**
     * @function CreateSession Create a Session.
     * @param {*} id ID.
     * @param {*} tag Tag.
     */
    this.CreateSession = function(id, tag) {
        Log(`[VOSSynchronizationService] Creating session ${id} with tag ${tag}`);
        return CreateSynchronizedSession(id, tag);
    }

    /**
     * @function DeleteSession Delete a Session.
     * @param {*} id ID.
     */
    this.DeleteSession = function(id) {
        Log(`[VOSSynchronizationService] Deleting session ${id}`);
        return DestroySynchronizedSession(id);
    }

    /**
     * @function GetSessions Get Sessions.
     * @returns All synchronized Sessions.
     */
    this.GetSessions = function() {
        return GetSynchronizedSessions();
    }

    /**
     * @function GetSession Get a Session.
     * @param {*} id ID.
     * @returns Session with ID, or null.
     */
    this.GetSession = function(id) {
        return GetSynchronizedSession(id);
    }

    /**
     * @function SendMessage Send a Message.
     * @param {*} topic Topic.
     * @param {*} message Message.
     */
    this.SendMessage = function(topic, message) {
        SendMessage(topic, message);
    }

    /**
     * @function ProcessMessage Process a Message.
     * @param {*} topic Topic.
     * @param {*} message Message.
     */
    function ProcessMessage(topic, message) {
        //Log(`${topic} ${message}`);
        parsedMessage = JSON.parse(message);
        switch (topic.toLowerCase()) {
            case "vos/session/create":
                HandleCreateSessionMessage(JSON.parse(message));
                returnTopic = "vos/session/new";
                returnMessage = message;
                returnMessage["message-id"] = uuidv4();
                delete returnMessage["client-id"];
                SendMessage(returnTopic, returnMessage);
                break;

            case "vos/session/destroy":
                HandleDestroySessionMessage(JSON.parse(message));
                returnTopic = "vos/session/closed"
                returnMessage = message;
                returnMessage["message-id"] = uuidv4();
                delete returnMessage["client-id"];
                SendMessage(returnTopic, returnMessage);
                break;

            case "vos/session/join":
                HandleJoinSessionMessage(JSON.parse(message));
                returnTopic = `vos/status/${parsedMessage["session-id"]}/newclient`;
                returnMessage = message;
                returnMessage["message-id"] = uuidv4();
                SendMessage(returnTopic, returnMessage);
                break;
            
            case "vos/session/exit":
                HandleExitSessionMessage(JSON.parse(message));
                returnTopic = `vos/status/${parsedMessage["session-id"]}/clientleft`;
                returnMessage = message;
                returnMessage["message-id"] = uuidv4();
                SendMessage(returnTopic, returnMessage);
                break;

            case "vos/session/heartbeat":
                HandleHeartbeatMessage(JSON.parse(message));
                break;

            case "vos/session/getstate":
                state = HandleSessionStateMessage(JSON.parse(message));
                returnTopic = `vos/status/${parsedMessage["session-id"]}/state`;
                returnMessage = JSON.parse(message);
                returnMessage["message-id"] = uuidv4();
                delete returnMessage["client-id"];
                if (state != null) {
                    clients = [];
                    state.clients.forEach(cl => {
                        let clientToAdd = {};
                        clientToAdd["id"] = cl["uuid"];
                        clientToAdd["tag"] = cl["tag"];
                        clients.push(clientToAdd);
                    });
                    returnMessage["clients"] = clients;
                    entities = [];
                    state.entities.forEach(entity => {
                        let entityToAdd = {};
                        entityToAdd["id"] = entity.uuid;
                        entityToAdd["tag"] = entity.tag;
                        entityToAdd["type"] = entity.type;
                        entityToAdd["path"] = entity.path;
                        if (entity.parent == null) {
                            entityToAdd["parent-id"] = null;
                        }
                        else {
                            entityToAdd["parent-id"] = entity.parent.uuid;
                        }
                        entityToAdd["position"] = entity.position;
                        entityToAdd["rotation"] = entity.rotation;
                        if (entityToAdd.isSize) {
                            entityToAdd["size"] = entity.scalesize;
                            entityToAdd["scale"] = null;
                        }
                        else {
                            entityToAdd["size"] = null;
                            entityToAdd["scale"] = entity.scalesize;
                        }
                        entities.push(entityToAdd);
                    });
                    returnMessage["entities"] = entities;
                }
                SendMessage(returnTopic, JSON.stringify(returnMessage));
                break;

            default:
                if (topic.startsWith("vos/request") && topic.endsWith("/createcontainerentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createcharacterentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateContainerEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createcharacterentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createcharacterentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateCharacterEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }    
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createmeshentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createmeshentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateMeshEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createbuttonentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createbuttonentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateButtonEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createcanvasentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createcanvasentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateCanvasEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createinputentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createinputentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateInputEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createlightentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createlightentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateLightEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createterrainentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createterrainentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateTerrainEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createtextentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createtextentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateTextEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/createvoxelentity")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/createvoxelentity", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleCreateVoxelEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("/message/create")) {
                    sessionUUID = topic.replace("vos/request/", "").replace("/message/create", "")
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = HandleSendMessageMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/").replace("/message/create", "/message/new");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    message["entity-id"] = entityUUID;
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("delete")) {
                    ids = topic.replace("vos/request/", "").replace("/delete", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleDeleteEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("remove")) {
                    ids = topic.replace("vos/request/", "").replace("/remove", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleRemoveEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("position")) {
                    ids = topic.replace("vos/request/", "").replace("/position", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandlePositionEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("rotation")) {
                    ids = topic.replace("vos/request/", "").replace("/rotation", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleRotateEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request/", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("scale")) {
                    ids = topic.replace("vos/request/", "").replace("/scale", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleScaleEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("size")) {
                    ids = topic.replace("vos/request/", "").replace("/size", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleSizeEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("canvastype")) {
                    ids = topic.replace("vos/request/", "").replace("/canvastype", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleCanvasTypeEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("highlight")) {
                    ids = topic.replace("vos/request/", "").replace("/highlight", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleHighlightStateEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("motion")) {
                    ids = topic.replace("vos/request/", "").replace("/motion", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleMotionEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("parent")) {
                    ids = topic.replace("vos/request/", "").replace("/parent", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleParentEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("physicalproperties")) {
                    ids = topic.replace("vos/request/", "").replace("/physicalproperties", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandlePhysicalPropertiesEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else if (topic.startsWith("vos/request/") && topic.endsWith("visibility")) {
                    ids = topic.replace("vos/request/", "").replace("/visibility", "").split("/entity/");
                    if (ids.length != 2) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Invalid message topic ${topic}`);
                        return;
                    }
                    sessionUUID = ids[0];
                    session = GetSynchronizedSession(sessionUUID);
                    if (session == null) {
                        console.error(`[VOSSynchronizationService->ProcessMessage] Unknown session ID ${sessionUUID}`);
                        return;
                    }
                    entityUUID = ids[1];
                    HandleVisibilityEntityMessage(session, JSON.parse(message));
                    returnTopic = topic.replace("vos/request", "vos/status/");
                    returnMessage = message;
                    returnMessage["message-id"] = uuidv4();
                    delete returnMessage["client-id"];
                    SendMessage(returnTopic, returnMessage);
                }
                else {
                    //Log(`Skipping message topic ${topic}`);
                    return;
                }
        };
    };

    /**
     * @function SendMessage Send a Message.
     * @param {*} topic Topic.
     * @param {*} message Message.
     */
    function SendMessage(topic, message) {
        if (client == null) {
            console.error("[VOSSynchronizationServer->SendMessageOnMQTT] No client.");
            return;
        }
        client.publish(topic, message);
    }
    
    /**
     * @function GetSynchronizedSessions Get Synchronized Sessions.
     * @returns All Synchronized Sessions.
     */
    function GetSynchronizedSessions() {
        let sessionInfos = [];
        for (session in vosSynchronizationSessions) {
            sessionInfos[session] = vosSynchronizationSessions[session].tag
        }
        return sessionInfos;
    }

    /**
     * @function CreateSynchronizedSession Create a synchronized Session.
     * @param {*} id ID.
     * @param {*} tag Tag.
     */
    function CreateSynchronizedSession(id, tag) {
        vosSynchronizationSessions[id] = new vosSynchronizationSession(id, tag);
    }

    /**
     * @function DestroySynchronizedSession Destroy a synchronized Session.
     * @param {*} id ID.
     */
    function DestroySynchronizedSession(id) {
        for (session in vosSynchronizationSessions) {
            if (session == id) {
                delete vosSynchronizationSessions[session];
            }
        }
    }
    
    /**
     * @function GetSynchronizedSession Get a Synchronized Session.
     * @param {*} id ID.
     * @returns Session with ID, or null.
     */
    function GetSynchronizedSession(id) {
        if (vosSynchronizationSessions[id] == null) {
            console.warn(`Session ${id} does not exist`);
            return;
        }
        return vosSynchronizationSessions[id];
    }

    /**
     * @function HandleCreateSessionMessage Handle a Create Session Message.
     * @param {*} data Data.
     */
    function HandleCreateSessionMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Create Session Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("session-tag")) {
            console.warn("Create Session Message does not contain: session-tag");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Create Session Message does not contain: client-id");
            return;
        }
        if (CanCreateSession(data["client-id"])) {
            Log(`Creating session ${data["session-id"]}, ${data["session-tag"]}`);
            CreateSynchronizedSession(data["session-id"], data["session-tag"]);
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to create a session`);
            return;
        }
    }

    /**
     * @function HandleDestroySessionMessage Handle a Destroy Session Message.
     * @param {*} data Data.
     */
    function HandleDestroySessionMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Destroy Session Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Create Session Message does not contain: client-id");
            return;
        }
        if (CanDestroySession(data["client-id"])) {
            Log(`Destroying session ${data["session-id"]}`);
            DestroySynchronizedSession(data["session-id"], data["session-tag"]);
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to destroy a session`);
            return;
        }
    }

    /**
     * @function HandleJoinSessionMessage Handle a Join Session Message.
     * @param {*} data Data.
     */
    function HandleJoinSessionMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Join Session Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Join Session Message does not contain: client-id");
            return;
        }
        if (!data.hasOwnProperty("client-tag")) {
            console.warn("Join Session Message does not contain: client-tag");
            return;
        }
        if (CanJoinSession(data["client-id"], data["session-id"])) {
            Log(`Client ${data["client-id"]}:${data["client-tag"]} is joining session ${data["session-id"]}`);
            sessionToJoin = GetSynchronizedSession(data["session-id"]);
            if (sessionToJoin == null) {
                console.warn("Unable to find session to join");
                return;
            }
            sessionToJoin.AddClient(data["client-id"], data["client-tag"]);
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to join session ${data["session-id"]}`);
            return;
        }
        
    }

    /**
     * @function HandleExitSessionMessage Handle an Exit Session Message.
     * @param {*} data Data.
     */
    function HandleExitSessionMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Exit Session Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Exit Session Message does not contain: client-id");
            return;
        }
        if (CanExitSession(data["client-id"], data["session-id"])) {
            Log(`Client ${data["client-id"]} is exiting session ${data["session-id"]}`);
            sessionToExit = GetSynchronizedSession(data["session-id"]);
            if (sessionToJoin == null) {
                console.warn("Unable to find session to exit");
                return;
            }
            sessionToExit.RemoveClient(data["client-id"]);
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to exit session ${data["session-id"]}`);
            return;
        }
    }

    /**
     * @function HandleHeartbeatMessage Handle a Heartbeat Message.
     * @param {*} data Data.
     */
    function HandleHeartbeatMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Heartbeat Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Heartbeat Message does not contain: client-id");
            return;
        }
        if (CanGiveHeartbeat(data["client-id"], data["session-id"])) {
            //Log(`Client ${data["client-id"]} gave heartbeat for session ${data["session-id"]}`);
            sessionToHeartbeat = GetSynchronizedSession(data["session-id"]);
            if (sessionToHeartbeat == null) {
                console.warn("Unable to find session to exit");
                return;
            }
            sessionToHeartbeat.UpdateHeartbeat(data["client-id"]);
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to heartbeat session ${data["session-id"]}`);
        }
    }

    /**
     * @function HandleSessionStateMessage Handle a Session State Message.
     * @param {*} data Data.
     */
    function HandleSessionStateMessage(data) {
        if (!data.hasOwnProperty("session-id")) {
            console.warn("Session State Message does not contain: session-id");
            return;
        }
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Session State Message does not contain: client-id");
            return;
        }
        if (CanGetSessionState(data["client-id"], data["session-id"])) {
            Log(`Client ${data["client-id"]} is requesting session ${data["session-id"]} state`);
            sessionToGetStateFor = GetSynchronizedSession(data["session-id"]);
            if (sessionToJoin == null) {
                console.warn("Unable to find session to get state for");
                return;
            }
            return sessionToGetStateFor;
        }
        else {
            Log(`Client ${data["client-id"]} is not allowed to get session ${data["session-id"]} state`);
            return;
        }
    }

    /**
     * @function HandleCreateContainerEntityMessage Handle a Create Container Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateContainerEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Container Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Container Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Container Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Container Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Container Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Container Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Container Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Container Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Container Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Container Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Container Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Container Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateContainerEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a container entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Container Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Container Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Container Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "container", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Container Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Container Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Container Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "container", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, null,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Container Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleCreateMeshEntityMessage Handle a Create Mesh Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateMeshEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Mesh Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Mesh Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Mesh Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("path")) {
            console.warn("Create Mesh Entity Message does not contain: path");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Mesh Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Mesh Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Mesh Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Mesh Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Mesh Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Mesh Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Mesh Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Mesh Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Mesh Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateMeshEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a mesh entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Mesh Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Mesh Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Mesh Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "mesh", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Mesh Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Mesh Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Mesh Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "mesh", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Mesh Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleCreateCharacterEntityMessage Handle a Create Character Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateCharacterEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Character Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Character Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Character Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("path")) {
            console.warn("Create Character Entity Message does not contain: path");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Character Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Character Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Character Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Character Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Character Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Character Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Character Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Character Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Character Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateCharacterEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a character entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Character Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Character Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Character Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "character", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Character Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Character Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Character Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "character", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Character Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleCreateButtonEntityMessage Handle a Create Button Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateButtonEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Button Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Button Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Button Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("on-click")) {
            console.warn("Create Button Entity Message does not contain: on-click");
            return;
        }
        if (!data.hasOwnProperty("position-percent")) {
            console.warn("Create Button Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Button Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Button Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Button Entity Message does not contain: position.z");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateButtonEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a button entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("size-percent")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Button Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Button Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Button Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "button", data.path,
                data.parent-uuid, data["position-percent"], null, data["size-percent"],
                null, null, null, null, null, null, null, clientToDeleteWith, entity["on-click"]);
            return entityuuid;
        }
        else {
            console.warn("Create Button Entity Message does not contain: size-percent");
            return;
        }
    }

    /**
     * @function HandleCreateCanvasEntityMessage Handle a Create Canvas Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateCanvasEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Canvas Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Canvas Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Canvas Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Canvas Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Canvas Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Canvas Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Canvas Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Canvas Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Canvas Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Canvas Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Canvas Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Canvas Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateCanvasEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a canvas entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Canvas Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Canvas Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Canvas Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "canvas", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Canvas Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Canvas Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Canvas Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "canvas", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, null,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Canvas Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleCreateInputEntityMessage Handle a Create Input Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateInputEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Input Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Input Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Input Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position-percent")) {
            console.warn("Create Input Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Input Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Input Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Input Entity Message does not contain: position.z");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateInputEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a input entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("size-percent")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Input Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Input Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Input Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "input", data.path,
                data.parent-uuid, data["position-percent"], null, data["size-percent"],
                null, clientToDeleteWith, null, null, null, null, null, null, entity["on-click"]);
            return entityuuid;
        }
        else {
            console.warn("Create Input Entity Message does not contain: size-percent");
            return;
        }
    }

    /**
     * @function HandleCreateLightEntityMessage Handle a Create Light Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateLightEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Light Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Light Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Light Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Light Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Light Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Light Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Light Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Light Entity Message does not contain: rotation");
            return
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Light Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Light Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Light Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Light Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateLightEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a light entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        session.AddEntityWithScale(entityuuid, data.tag, "light", data.path,
            data.parent-uuid, data.position, data.rotation, null, null,
            null, null, null, null, null, null, clientToDeleteWith, null);
        return entityuuid;
    }

    /**
     * @function HandleCreateTerrainEntityMessage Handle a Create Terrain Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateTerrainEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Terrain Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Terrain Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Terrain Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Terrain Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Terrain Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Terrain Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Terrain Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Terrain Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Terrain Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Terrain Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Terrain Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Terrain Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateTerrainEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a terrain entity in session ${session.id}`);
            return;
        }
        if (!data.hasOwnProperty("length")) {
            console.warn("Create Terrain Entity Message does not contain: length");
            return;
        }
        if (!data.hasOwnProperty("width")) {
            console.warn("Create Terrain Entity Message does not contain: width");
            return;
        }
        if (!data.hasOwnProperty("height")) {
            console.warn("Create Terrain Entity Message does not contain: height");
            return;
        }
        if (!data.hasOwnProperty("heights")) {
            console.warn("Create Terrain Entity Message does not contain: heights");
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Terrain Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Terrain Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Terrain Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "terrain", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                data.length, data.width, data.height, data.heights, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Terrain Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Terrain Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Terrain Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "terrain", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, null,
                data.length, data.width, data.height, data.heights, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Terrain Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleCreateTextEntityMessage Handle a Create Text Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateTextEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Text Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Text Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Text Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position-percent")) {
            console.warn("Create Text Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Text Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Text Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Text Entity Message does not contain: position.z");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateTextEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a text entity in session ${session.id}`);
            return;
        }
        if (!data.hasOwnProperty("text")) {
            console.warn("Create Text Entity Message does not contain: text");
            return;
        }
        if (!data.hasOwnProperty("font-size")) {
            console.warn("Create Text Entity Message does not contain: font-size");
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("size-percent")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Text Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Text Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Text Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "text", data.path,
                data.parent-uuid, data["position-percent"], null, data["size-percent"],
                null, clientToDeleteWith, null, null, null, null, entity.text,
                entity["font-size"], entity["on-click"]);
            return entityuuid;
        }
        else {
            console.warn("Create Text Entity Message does not contain: size-percent");
            return;
        }
    }

    /**
     * @function HandleCreateVoxelEntityMessage Handle a Create Voxel Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCreateVoxelEntityMessage(session, data) {
        if (!data.hasOwnProperty("delete-with-client")) {
            console.warn("Create Voxel Entity Message does not contain: delete-with-client");
            return;
        }
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Create Voxel Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("tag")) {
            console.warn("Create Voxel Entity Message does not contain: tag");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Create Voxel Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Create Voxel Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Create Voxel Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Create Voxel Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Create Voxel Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Create Voxel Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Create Voxel Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Create Voxel Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Create Voxel Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (session == null) {
            console.warn("No session to create entity in");
            return;
        }
        if (!CanCreateVoxelEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to create a voxel entity in session ${session.id}`);
            return;
        }
        clientToDeleteWith = null;
        if (data["delete-with-client"] == true) {
            clientToDeleteWith = data["client-id"];
        }
        
        entityuuid = data["entity-id"];
        if (data.hasOwnProperty("scale")) {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Create Voxel Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Create Voxel Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Create Voxel Entity Message does not contain: scale.z");
                return;
            }
            session.AddEntityWithScale(entityuuid, data.tag, "voxel", data.path,
                data["parent-uuid"], data.position, data.rotation, data.scale, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else if (data.hasOwnProperty("size")) {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Create Voxel Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Create Voxel Entity Message does not contain: size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Create Voxel Entity Message does not contain: size.z");
                return;
            }
            session.AddEntityWithSize(entityuuid, data.tag, "voxel", data.path,
                data.parent-uuid, data.position, data.rotation, data.size, data.resources,
                null, null, null, null, null, null, clientToDeleteWith, null);
            return entityuuid;
        }
        else {
            console.warn("Create Voxel Entity Message does not contain: scale");
            return;
        }
    }

    /**
     * @function HandleSendMessageMessage Handle a Send Message Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleSendMessageMessage(session, data) {
        if (!data.hasOwnProperty("client-id")) {
            console.warn("Send Message Message does not contain: client-id");
            return;
        }
        if (!data.hasOwnProperty("topic")) {
            console.warn("Send Message Message does not contain: topic");
            return;
        }
        if (!data.hasOwnProperty("message")) {
            console.warn("Send Message Message does not contain: message");
            return;
        }
        if (session == null) {
            console.warn("No session to send message in");
            return;
        }
        if (!CanSendMessage(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to send a message in session ${session.id}`);
            return;
        }
    }

    /**
     * @function HandleDeleteEntityMessage Handle a Delete Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleDeleteEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Delete Entity Message does not contain: entity-id");
            return;
        }
        if (!CanDeleteEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to delete an entity in session ${session.id}`);
            return;
        }
        session.RemoveEntity(data["entity-id"]);
    }

    /**
     * @function HandleRemoveEntityMessage Handle a Remove Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleRemoveEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Remove Entity Message does not contain: entity-id");
            return;
        }
        if (!CanRemoveEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to remove an entity in session ${session.id}`);
            return;
        }
        session.RemoveEntity(data["entity-id"]);
    }

    /**
     * @function HandlePositionEntityMessage Handle a Position Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandlePositionEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Position Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Position Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Position Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Position Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Position Entity Message does not contain: position.z");
                return;
            }
        }
        if (!CanPositionEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to position an entity in session ${session.id}`);
            return;
        }
        session.PositionEntity(data["entity-id"], data.position);
    }

    /**
     * @function HandleRotateEntityMessage Handle a Rotate Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleRotateEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Rotate Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("rotation")) {
            console.warn("Rotate Entity Message does not contain: rotation");
            return;
        }
        else {
            if (!data.rotation.hasOwnProperty("x")) {
                console.warn("Rotate Entity Message does not contain: rotation.x");
                return;
            }
            if (!data.rotation.hasOwnProperty("y")) {
                console.warn("Rotate Entity Message does not contain: rotation.y");
                return;
            }
            if (!data.rotation.hasOwnProperty("z")) {
                console.warn("Rotate Entity Message does not contain: rotation.z");
                return;
            }
            if (!data.rotation.hasOwnProperty("w")) {
                console.warn("Rotate Entity Message does not contain: rotation.w");
                return;
            }
        }
        if (!CanRotateEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to rotate an entity in session ${session.id}`);
            return;
        }
        session.RotateEntity(data["entity-id"], data.rotation);
    }

    /**
     * @function HandleScaleEntityMessage Handle a Scale Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleScaleEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Scale Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("scale")) {
            console.warn("Scale Entity Message does not contain: scale");
            return;
        }
        else {
            if (!data.scale.hasOwnProperty("x")) {
                console.warn("Scale Entity Message does not contain: scale.x");
                return;
            }
            if (!data.scale.hasOwnProperty("y")) {
                console.warn("Scale Entity Message does not contain: scale.y");
                return;
            }
            if (!data.scale.hasOwnProperty("z")) {
                console.warn("Scale Entity Message does not contain: scale.z");
                return;
            }
        }
        if (!CanScaleEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to scale an entity in session ${session.id}`);
            return;
        }
        session.ScaleEntity(data["entity-id"], data.scale);
    }

    /**
     * @function HandleSizeEntityMessage Handle a Size Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleSizeEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Size Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("size")) {
            console.warn("Size Entity Message does not contain: size");
            return;
        }
        else {
            if (!data.size.hasOwnProperty("x")) {
                console.warn("Size Entity Message does not contain: size.x");
                return;
            }
            if (!data.size.hasOwnProperty("y")) {
                console.warn("Size Entity Message does not contain: Size.y");
                return;
            }
            if (!data.size.hasOwnProperty("z")) {
                console.warn("Size Entity Message does not contain: size.z");
                return;
            }
        }
        if (!CanSizeEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to size an entity in session ${session.id}`);
            return;
        }
        session.SizeEntity(data["entity-id"], data.size);
    }

    /**
     * @function HandleCanvasTypeEntityMessage Handle a Canvas Type Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleCanvasTypeEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Canvas Type Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("canvas-type")) {
            console.warn("Canvas Type Entity Message does not contain: canvas-type");
            return;
        }
        if (!CanSetEntityCanvasType(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to set entity canvas type in session ${session.id}`);
            return;
        }
        session.SetCanvasType(data["entity-id"], data["canvas-type"]);
    }

    /**
     * @function HandleHighlightStateEntityMessage Handle a Highlight State Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleHighlightStateEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Highlight State Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("highlighted")) {
            console.warn("Highlight State Entity Message does not contain: highlighted");
            return;
        }
        if (!CanSetEntityHighlightState(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to set entity highlight state in session ${session.id}`);
            return;
        }
        session.SetHighlightState(data["entity-id"], data.highlighted);
    }

    /**
     * @function HandleMotionEntityMessage Handle a Motion Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleMotionEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Motion Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("angular-velocity")) {
            console.warn("Motion Entity Message does not contain: angular-velocity");
            return;
        }
        if (!data.hasOwnProperty("velocity")) {
            console.warn("Motion Entity Message does not contain: velocity");
            return;
        }
        if (!data.hasOwnProperty("stationary")) {
            console.warn("Motion Entity Message does not contain: stationary");
            return;
        }
        session.SetMotionState(data["entity-id"], data["angular-velocity"], data.velocity, data.stationary);
    }

    /**
     * @function HandleParentEntityMessage Handle a Parent Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleParentEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Parent Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("parent-id")) {
            console.warn("Parent Entity Message does not contain: parent-id");
            return;
        }
        session.ParentEntity(data["entity-id"], data["parent-id"]);
    }

    /**
     * @function HandlePhysicalPropertiesEntityMessage Handle a Physical Properties Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandlePhysicalPropertiesEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Physical Properties Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("angular-drag")) {
            console.warn("Physical Properties Entity Message does not contain: angular-drag");
            return;
        }
        if (!data.hasOwnProperty("center-of-mass")) {
            console.warn("Physical Properties Entity Message does not contain: center-of-mass");
            return;
        }
        if (!data.hasOwnProperty("drag")) {
            console.warn("Physical Properties Entity Message does not contain: drag");
            return;
        }
        if (!data.hasOwnProperty("gravitational")) {
            console.warn("Physical Properties Entity Message does not contain: gravitational");
            return;
        }
        if (!data.hasOwnProperty("mass")) {
            console.warn("Physical Properties Entity Message does not contain: mass");
            return;
        }
        session.SetPhysicalState(data["entity-id"], data["angular-drag"], data["center-of-mass"],
            data.drag, data.gravitational, data.mass);
    }

    /**
     * @function HandleVisibilityEntityMessage Handle a Visibility Entity Message.
     * @param {*} session Session.
     * @param {*} data Data.
     */
    function HandleVisibilityEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Visibility Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("visible")) {
            console.warn("Visibility Entity Message does not contain: angular-drag");
            return;
        }
        session.SetVisibility(data["entity-id"], entity.visible);
    }

    /**
     * @function CanCreateSession Determine whether or not the client can create a session.
     * @param {*} clientID Client ID.
     * @returns Whether or not the client can create a session.
     */
    function CanCreateSession(clientID) {
        return true;
    }

    /**
     * @function CanDestroySession Determine whether or not the client can destroy a session.
     * @param {*} clientID Client ID.
     * @returns Whether or not the client can destroy a session.
     */
    function CanDestroySession(clientID) {
        return true;
    }

    /**
     * @function CanJoinSession Determine whether or not the client can join a session.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can join a session.
     */
    function CanJoinSession(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanExitSession Determine whether or not the client can exit a session.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can exit a session.
     */
    function CanExitSession(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanGiveHeartbeat Determine whether or not the client can give a heartbeat.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can give a heartbeat.
     */
    function CanGiveHeartbeat(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanGetSessionState Determine whether or not the client can get the session state.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can get the session state.
     */
    function CanGetSessionState(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateContainerEntity Determine whether or not the client can create a container entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a container entity.
     */
    function CanCreateContainerEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateMeshEntity Determine whether or not the client can create a mesh entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a mesh entity.
     */
    function CanCreateMeshEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateCharacterEntity Determine whether or not the client can create a character entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a character entity.
     */
    function CanCreateCharacterEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateButtonEntity Determine whether or not the client can create a button entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a button entity.
     */
    function CanCreateButtonEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateCanvasEntity Determine whether or not the client can create a canvas entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a canvas entity.
     */
    function CanCreateCanvasEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateInputEntity Determine whether or not the client can create an input entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create an input entity.
     */
    function CanCreateInputEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateLightEntity Determine whether or not the client can create a light entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a light entity.
     */
    function CanCreateLightEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateTerrainEntity Determine whether or not the client can create a terrain entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a terrain entity.
     */
    function CanCreateTerrainEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateTextEntity Determine whether or not the client can create a text entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a text entity.
     */
    function CanCreateTextEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanCreateVoxelEntity Determine whether or not the client can create a voxel entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a voxel entity.
     */
    function CanCreateVoxelEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanSendMessage Determine whether or not the client can send a message.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can send a message.
     */
    function CanSendMessage(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanDeleteEntity Determine whether or not the client can delete an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can delete an entity.
     */
    function CanDeleteEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanRemoveEntity Determine whether or not the client can remove an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can remove an entity.
     */
    function CanRemoveEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanPositionEntity Determine whether or not the client can position an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can position an entity.
     */
    function CanPositionEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanRotateEntity Determine whether or not the client can rotate an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can rotate an entity.
     */
    function CanRotateEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanScaleEntity Determine whether or not the client can scale an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can scale an entity.
     */
    function CanScaleEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanSizeEntity Determine whether or not the client can size an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can size an entity.
     */
    function CanSizeEntity(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanSetEntityCanvasType Determine whether or not the client set an entity canvas type.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can set an entity canvas type.
     */
    function CanSetEntityCanvasType(clientID, sessionID) {
        return true;
    }

    /**
     * @function CanSetEntityHighlightState Determine whether or not the client can set an entity highlight state.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can set an entity highlight state.
     */
    function CanSetEntityHighlightState(clientID, sessionID) {
        return true;
    }

    /**
     * @function Log Log a message.
     * @param {*} text Text to log.
     */
    function Log(text) {
        console.log(text);
        if (process.platform == "win32") {
            fs.appendFile(".\\vss.log", text + "\n", function(err){
                
            });
        } else {
            fs.appendFile("./vss.log", text + "\n", function(err){

            });
        }
    }

    /**
     * @function CheckHeartbeats Check Heartbeats.
     */
    this.CheckHeartbeats = function()  {
        for (session in vosSynchronizationSessions) {
            sess = GetSynchronizedSession(session);
            if (sess == null) {
                console.warn(`[VOSSynchronizationService->CheckHeartbeats] Session ${session} invalid`);
                continue;
            }
            sess.clients.forEach(client => {
                if (Date.now() - client.lastHeartbeat > 250000) {
                    console.warn(`[VOSSynchronizationService->CheckHeartbeats] ClientID: ${client.uuid} timed out`);
                    sess.clients.forEach(cl => {
                        if (cl.uuid == client.uuid) {
                            index = sess.clients.indexOf(cl);
                            if (index > -1) {
                                sess.clients[index].entitiesToDestroyOnExit.forEach(entity => {
                                    topic = "vos/status/" + sess.id + "/entity/" + entity + "/delete";
                                    message = {};
                                    message["message-id"] = uuidv4();
                                    message["session-id"] = sess.id;
                                    message["entity-id"] = entity;
                                    SendMessage(topic, JSON.stringify(message));
                                });
                            }
                            return;
                        }
                    });
                    sess.RemoveClient(client.uuid);
                }
            });
        }
    }

    setInterval(() => { this.CheckHeartbeats() }, 5000);
};