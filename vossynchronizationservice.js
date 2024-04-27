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
    this.VERSION = "1.1.0"

    /**
     * Callback for checking Create Session Authorization.
     */
    this.createSessionAuthCallback = null;

    /**
     * Callback for checking Destroy Session Authorization.
     */
    this.destroySessionAuthCallback = null;

    /**
     * Callback for checking Join Session Authorization.
     */
    this.joinSessionAuthCallback = null;

    /**
     * Callback for checking Exit Session Authorization.
     */
    this.exitSessionAuthCallback = null;

    /**
     * Callback for checking Give Heartbeat Authorization.
     */
    this.giveHeartbeatAuthCallback = null;

    /**
     * Callback for checking Get Session State Authorization.
     */
    this.getSessionStateAuthCallback = null;

    /**
     * Callback for checking Create Container Entity Authorization.
     */
    this.createContainerEntityAuthCallback = null;

    /**
     * Callback for checking Create Mesh Entity Authorization.
     */
    this.createMeshEntityAuthCallback = null;

    /**
     * Callback for checking Create Character Entity Authorization.
     */
    this.createCharacterEntityAuthCallback = null;

    /**
     * Callback for checking Create Button Entity Authorization.
     */
    this.createButtonEntityAuthCallback = null;
    
    /**
     * Callback for checking Create Canvas Entity Authorization.
     */
    this.createCanvasEntityAuthCallback = null;

    /**
     * Callback for checking Create Input Entity Authorization.
     */
    this.createInputEntityAuthCallback = null;

    /**
     * Callback for checking Create Light Entity Authorization.
     */
    this.createLightEntityAuthCallback = null;

    /**
     * Callback for checking Create Terrain Entity Authorization.
     */
    this.createTerrainEntityAuthCallback = null;

    /**
     * Callback for checking Create Text Entity Authorization.
     */
    this.createTextEntityAuthCallback = null;

    /**
     * Callback for checking Create Voxel Entity Authorization.
     */
    this.createVoxelEntityAuthCallback = null;

    /**
     * Callback for checking Send Message Authorization.
     */
    this.sendMessageAuthCallback = null;

    /**
     * Callback for checking Delete Entity Authorization.
     */
    this.deleteEntityAuthCallback = null;

    /**
     * Callback for checking Remove Entity Authorization.
     */
    this.removeEntityAuthCallback = null;

    /**
     * Callback for checking Position Entity Authorization.
     */
    this.positionEntityAuthCallback = null;

    /**
     * Callback for checking Rotate Entity Authorization.
     */
    this.rotateEntityAuthCallback = null;

    /**
     * Callback for checking Scale Entity Authorization.
     */
    this.scaleEntityAuthCallback = null;

    /**
     * Callback for checking Size Entity Authorization.
     */
    this.sizeEntityAuthCallback = null;

    /**
     * Callback for checking Modify Terrain Entity Authorization.
     */
    this.modifyTerrainEntityAuthCallback = null;

    /**
     * Callback for checking Set Entity Canvas Type Authorization.
     */
    this.setEntityCanvasTypeAuthCallback = null;

    /**
     * Callback for checking Set Entity Highlight State Authorization.
     */
    this.setEntityHighlightStateAuthCallback = null;

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
        CreateSynchronizedSession(id, tag);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": id,
            "session-tag": tag
        };
        SendMessage("vos/session/new", messageToSend);
    }

    /**
     * @function DeleteSession Delete a Session.
     * @param {*} id ID.
     */
    this.DeleteSession = function(id) {
        Log(`[VOSSynchronizationService] Deleting session ${id}`);
        DestroySynchronizedSession(id);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": id
        };
        SendMessage("vos/session/closed", );
    }

    /**
     * @function JoinSession Join a Session.
     * @param {*} session Session.
     * @param {*} clientID Client ID.
     * @param {*} clientTag Client Tag.
     */
    this.JoinSession = function(session, clientID, clientTag) {
        session.AddClient(clientID, clientTag);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "client-tag": clientTag
        };
        SendMessage("vos/status/" + session.id + "/newclient", );
    }

    /**
     * @function ExitSession Exit a Session.
     * @param {*} session Session.
     * @param {*} clientID Client ID.
     */
    this.ExitSession = function(session, clientID) {
        session.RemoveClient(clientID);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID
        };
        SendMessage("vos/status/" + session.id + "/clientleft", );
    }

    /**
     * @function CreateContainerEntity Create a Container Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateContainerEntity = function(session, entityID, entityTag, parentID,
        position, rotation, scale, clientToDeleteWith) {
        session.AddEntityWithScale(entityID, entityTag, "container", null,
            parentID, position, rotation, scale, null,
            null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
            clientToDeleteWith, null);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "position": position,
            "rotation": rotation,
            "scale": scale
        };
        SendMessage("vos/status/" + session.id + "/createcontainerentity", messageToSend);
    }

    /**
     * @function CreateMeshEntity Create a Mesh Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path to mesh resource.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} resources Mesh resources.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateMeshEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, scale, isSize, resources, clientToDeleteWith) {
        if (isSize) {
            session.AddEntityWithSize(entityID, entityTag, "mesh", path,
                parentID, position, rotation, scale, resources,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);

            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "resources": resources,
                "position": position,
                "rotation": rotation,
                "size": scale
            };
            SendMessage("vos/status/" + session.id + "/createmeshentity", messageToSend);
        }
        else {
            session.AddEntityWithScale(entityID, entityTag, "mesh", path,
            parentID, position, rotation, scale, resources,
            null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
            clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "resources": resources,
                "position": position,
                "rotation": rotation,
                "scale": scale
            };
            SendMessage("vos/status/" + session.id + "/createmeshentity", messageToSend);
        }
    }

    /**
     * @function CreateCharacterEntity Create a Character Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path to mesh resource.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} resources Mesh resources.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateCharacterEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, scale, isSize, clientToDeleteWith) {
        if (isSize) {
            session.AddEntityWithSize(entityID, entityTag, "character", path,
                parentID, position, rotation, scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "size": scale
            };
            SendMessage("vos/status/" + session.id + "/createcharacterentity", messageToSend);
        }
        else {
            session.AddEntityWithScale(entityID, entityTag, "character", path,
                parentID, position, rotation, scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "scale": scale
            };
            SendMessage("vos/status/" + session.id + "/createcharacterentity", messageToSend);
        }
    }

    /**
     * @function CreateButtonEntity Create a Button Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} parentID Parent ID.
     * @param {*} positionPercent Position Percent.
     * @param {*} sizePercent Size Percent.
     * @param {*} clientToDeleteWith Client to delete entity with.
     * @param {*} onClick On click event.
     */
    this.CreateButtonEntity = function(session, entityID, entityTag, parentID,
        positionPercent, sizePercent, clientToDeleteWith, onClick) {
            session.AddEntityWithCanvasTransform(entityID, entityTag, "button", null,
            parentID, positionPercent, sizePercent, null, null, null,
            clientToDeleteWith, onClick);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "path": path,
            "position-percent": positionPercent,
            "size-percent": sizePercent,
            "on-click": onClick
        };
        SendMessage("vos/status/" + session.id + "/createbuttonentity", messageToSend);
    }

    /**
     * @function CreateCanvasEntity Create a Canvas Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateCanvasEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, scale, isSize, clientToDeleteWith) {
        if (isSize) {
            session.AddEntityWithSize(entityID, entityTag, "canvas", path,
                parentID, position, rotation, scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "size": scale
            };
            SendMessage("vos/status/" + session.id + "/createcanvasentity", messageToSend);
        }
        else {
            session.AddEntityWithScale(entityID, entityTag, "canvas", path,
                parentID, position, rotation, scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "scale": scale
            };
            SendMessage("vos/status/" + session.id + "/createcanvasentity", messageToSend);
        }
    }

    /**
     * @function CreateInputEntity Create an Input Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} parentID Parent ID.
     * @param {*} positionPercent Position Percent.
     * @param {*} sizePercent Size Percent.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateInputEntity = function(session, entityID, entityTag, parentID,
        positionPercent, sizePercent, clientToDeleteWith) {
            session.AddEntityWithCanvasTransform(entityID, entityTag, "input", null,
            parentID, positionPercent, sizePercent, null, null, null,
            clientToDeleteWith, null);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "path": path,
            "position-percent": positionPercent,
            "size-percent": sizePercent
        };
        SendMessage("vos/status/" + session.id + "/createinputentity", messageToSend);
    }

    /**
     * @function CreateLightEntity Create a Light Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateLightEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, clientToDeleteWith) {
        session.AddEntityWithScale(entityID, entityTag, "light", path,
            parentID, position, rotation, null, null,
            null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
            clientToDeleteWith, null);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "path": path,
            "position": position,
            "rotation": rotation
        };
        SendMessage("vos/status/" + session.id + "/createlightentity", messageToSend);
    }

    /**
     * @function CreateTerrainEntity Create a Terrain Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} length Length.
     * @param {*} width Width.
     * @param {*} height Height.
     * @param {*} heights Heights.
     * @param {*} diffuseTexture Diffuse Texture.
     * @param {*} normalTexture Normal Texture.
     * @param {*} maskTexture Mask Texture.
     * @param {*} specularValues Specular Values.
     * @param {*} metallicValues Metallic Values.
     * @param {*} smoothnessValues Smoothness Values.
     * @param {*} layerMask Layer Mask.
     * @param {*} type Type.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateTerrainEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, length, width, height, heights, diffuseTexture,
        normalTexture, maskTexture, specularValues, metallicValues, smoothnessValues,
        layerMask, type, modifications, clientToDeleteWith) {
        session.AddEntityWithScale(entityID, entityTag, "terrain", path,
            parentID, position, rotation, null, null,
            length, width, height, heights, diffuseTexture, normalTexture, maskTexture,
            specularValues, metallicValues, smoothnessValues, layerMask, type, null, null,
            { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, modifications,
            clientToDeleteWith, null);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "path": path,
            "position": position,
            "rotation": rotation,
            "length": length,
            "width": width,
            "height": height,
            "heights": heights,
            "diffuse-texture": diffuseTexture,
            "normal-texture": normalTexture,
            "mask-texture": maskTexture,
            "specular-values": specularValues,
            "metallic-values": metallicValues,
            "smoothness-values": smoothnessValues,
            "layer-mask": layerMask,
            "type": type,
            "modifications": modifications
        };
        SendMessage("vos/status/" + session.id + "/createterrainentity", messageToSend);
    }

    /**
     * @function CreateTextEntity Create a Text Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} parentID Parent ID.
     * @param {*} positionPercent Position Percent.
     * @param {*} sizePercent Size Percent.
     * @param {*} clientToDeleteWith Client to delete entity with.
     * @param {*} text Text.
     * @param {*} fontSize Font Size.
     */
    this.CreateTextEntity = function(session, entityID, entityTag, parentID,
        positionPercent, sizePercent, clientToDeleteWith, text, fontSize) {
            session.AddEntityWithCanvasTransform(entityID, entityTag, "text", null,
            parentID, positionPercent, sizePercent, null, text, fontSize,
            clientToDeleteWith, null);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "tag": entityTag,
            "parent-id": parentID,
            "path": path,
            "position-percent": positionPercent,
            "size-percent": sizePercent,
            "text": text,
            "font-size": fontSize
        };
        SendMessage("vos/status/" + session.id + "/createtextentity", messageToSend);
    }

    /**
     * @function CreateVoxelEntity Create a Voxel Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} entityTag Entity Tag.
     * @param {*} path Path.
     * @param {*} parentID Parent ID.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} isSize Whether or not the scale is a size.
     * @param {*} resources Resources.
     * @param {*} clientToDeleteWith Client to delete entity with.
     */
    this.CreateVoxelEntity = function(session, entityID, entityTag, path, parentID,
        position, rotation, scale, isSize, resources, clientToDeleteWith) {
        if (isSize) {
            session.AddEntityWithSize(entityID, entityTag, "voxel", path,
                parentID, position, rotation, scale, resources,
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "size": scale
            };
            SendMessage("vos/status/" + session.id + "/createvoxelentity", messageToSend);
        }
        else {
            session.AddEntityWithScale(entityID, entityTag, "voxel", path,
            parentID, position, rotation, scale, resources,
            null, null, null, null, null, null, null, null, null, null, null,
            null, null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
            clientToDeleteWith, null);
            messageToSend = {
                "message-id": uuidv4(),
                "session-id": session.id,
                "client-id": clientID,
                "entity-id": entityID,
                "tag": entityTag,
                "parent-id": parentID,
                "path": path,
                "position": position,
                "rotation": rotation,
                "scale": scale
            };
            SendMessage("vos/status/" + session.id + "/createvoxelentity", messageToSend);
        }
    }

    /**
     * @function SendMessageMessage Send a Message through VSS.
     * @param {*} topic Topic.
     * @param {*} message Message.
     */
    this.SendMessageMessage = function(topic, message) {
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "topic": topic,
            "message": message
        };
        SendMessage("vos/status/" + session.id + "/message/create", messageToSend);
    }

    /**
     * @function DeleteEntity Delete an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     */
    this.DeleteEntity = function(session, entityID) {
        session.RemoveEntity(entityID);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/delete", messageToSend);
    }

    /**
     * @function RemoveEntity Remove an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     */
    this.RemoveEntity = function(session, entityID) {
        session.RemoveEntity(entityID);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/remove", messageToSend);
    }

    /**
     * @function PositionEntity Position an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} position Position.
     */
    this.PositionEntity = function(session, entityID, position) {
        session.PositionEntity(entityID, position);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "position": position
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/position", messageToSend);
    }

    /**
     * @function RotateEntity Rotate an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} rotation Rotation.
     */
    this.RotateEntity = function(session, entityID, rotation) {
        session.RotateEntity(entityID, rotation);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "rotation": rotation
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/rotation", messageToSend);
    }

    /**
     * @function ScaleEntity Scale an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} scale Scale.
     */
    this.ScaleEntity = function(session, entityID, scale) {
        session.ScaleEntity(entityID, scale);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "scale": scale
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/scale", messageToSend);
    }

    /**
     * @function SizeEntity Size an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} size Size.
     */
    this.SizeEntity = function(session, entityID, size) {
        session.SizeEntity(entityID, size);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "size": size
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/size", messageToSend);
    }

    /**
     * @function ModifyTerrainEntity Modify a Terrain Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} modification Modification.
     * @param {*} position Position.
     * @param {*} brushType Brush Type.
     * @param {*} layer Layer.
     */
    this.ModifyTerrainEntity = function(session, entityID,
        modification, position, brushType, layer) {
        session.ModifyTerrainEntity(entityID, modification, position, brushType, layer);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "modification": modification,
            "position": position,
            "brush-type": brushType,
            "layer": layer
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/terrain-mod", messageToSend);
    }

    /**
     * @function SetCanvasType Set the Canvas Type of an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} type Type.
     */
    this.SetCanvasType = function(session, entityID, type) {
        session.SetCanvasType(entityID, type);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "canvas-type": type
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/canvastype", messageToSend);
    }

    /**
     * @function SetHighlightState Set the Highlight State of an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} highlighted Highlighted.
     */
    this.SetHighlightState = function(session, entityID, highlighted) {
        session.SetHighlightState(entityID, highlighted);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "highlighted": highlighted
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/highlight", messageToSend);
    }

    /**
     * @function SetMotionState Set the Motion State of an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} angularVelocity Angular Velocity.
     * @param {*} velocity Velocity.
     * @param {*} stationary Stationary.
     */
    this.SetMotionState = function(session, entityID, angularVelocity, velocity, stationary) {
        session.SetMotionState(entityID, angularVelocity, velocity, stationary);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "angular-velocity": angularVelocity,
            "velocity": velocity,
            "stationary": stationary
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/motion", messageToSend);
    }

    /**
     * @function ParentEntity Parent an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} parentID Parent ID.
     */
    this.ParentEntity = function(session, entityID, parentID) {
        session.ParentEntity(entityID, parentID);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "parent-id": parentID
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/parent", messageToSend);
    }

    /**
     * @function SetPhysicalState Set the Physical State of an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity.
     * @param {*} angularDrag Angular Drag.
     * @param {*} centerOfMass Center of Mass.
     * @param {*} drag Drag.
     * @param {*} gravitational Gravitational.
     * @param {*} mass Mass.
     */
    this.SetPhysicalState = function(session, entityID, angularDrag, centerOfMass, drag, gravitational, mass) {
        session.SetPhysicalState(entityID, angularDrag, centerOfMass, drag, gravitational, mass);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": entityID,
            "angular-drag": angularDrag,
            "center-of-mass": centerOfMass,
            "drag": drag,
            "gravitational": gravitational,
            "mass": mass
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/physicalproperties", messageToSend);
    }

    /**
     * @function SetVisibility Set the Visibility of an Entity.
     * @param {*} session Session.
     * @param {*} entityID Entity ID.
     * @param {*} visibility Visibility.
     */
    this.SetVisibility = function(session, entityID, visibility) {
        session.SetVisibility(entityID, visibility);
        messageToSend = {
            "message-id": uuidv4(),
            "session-id": session.id,
            "client-id": clientID,
            "entity-id": clientTag,
            "visible": visibility
        };
        SendMessage("vos/status/" + session.id + "/entity/" + entityID + "/visibility", messageToSend);
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
                else if (topic.startsWith("vos/request/") && topic.endsWith("terrain-mod")) {
                    ids = topic.replace("vos/request/", "").replace("/terrain-mod", "").split("/entity/");
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
                    HandleModifyTerrainEntityMessage(session, JSON.parse(message));
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
            session.AddEntityWithScale(entityuuid, data.tag, "container", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
            session.AddEntityWithSize(entityuuid, data.tag, "container", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
                data["parent-uuid"], data.position, data.rotation, data.scale, data.resources,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
                data["parent-uuid"], data.position, data.rotation, data.scale, data.resources,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "button", null,
                data.parent-uuid, data["position-percent"], data["size-percent"],
                null, null, null, clientToDeleteWith, entity["on-click"]);
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
            session.AddEntityWithScale(entityuuid, data.tag, "canvas", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
            session.AddEntityWithSize(entityuuid, data.tag, "canvas", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "input", null,
                data.parent-uuid, data["position-percent"], data["size-percent"],
                null, null, null, clientToDeleteWith, null);
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
        session.AddEntityWithScale(entityuuid, data.tag, "light", null,
            data["parent-uuid"], data.position, data.rotation, null, null,
            null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
            { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
            clientToDeleteWith, null);
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
        if (!data.hasOwnProperty("diffuse-texture")) {
            console.warn("Create Terrain Entity Message does not contain: diffuse-texture");
            return;
        }
        if (!data.hasOwnProperty("normal-texture")) {
            console.warn("Create Terrain Entity Message does not contain: normal-texture");
            return;
        }
        if (!data.hasOwnProperty("mask-texture")) {
            console.warn("Create Terrain Entity Message does not contain: mask-texture");
            return;
        }
        if (!data.hasOwnProperty("specular-values")) {
            console.warn("Create Terrain Entity Message does not contain: specular-values");
            return;
        }
        if (!data.hasOwnProperty("metallic-values")) {
            console.warn("Create Terrain Entity Message does not contain: metallic-values");
            return;
        }
        if (!data.hasOwnProperty("smoothness-values")) {
            console.warn("Create Terrain Entity Message does not contain: smoothness-values");
            return;
        }
        if (!data.hasOwnProperty("layer-mask")) {
            console.warn("Create Terrain Entity Message does not contain: layer-mask");
            return;
        }
        if (!data.hasOwnProperty("type")) {
            console.warn("Create Terrain Entity Message does not contain: layer-mask");
            return;
        }
        if (!data.hasOwnProperty("terrain-modification")) {
            console.warn("Create Terrain Entity Message does not contain: terrain-modification");
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
                data.length, data.width, data.height, data.heights, data["diffuse-texture"],
                data["normal-texture"], data["mask-texture"], data["specular-values"],
                data["metallic-values"], data["smoothness-values"], data["layer-mask"], data["type"],
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, data["terrain-modification"],
                clientToDeleteWith, null);
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
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                data.length, data.width, data.height, data.heights, data["diffuse-texture"],
                data["normal-texture"], data["mask-texture"], data["specular-values"],
                data["metallic-values"], data["smoothness-values"], data["layer-mask"], data["type"],
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, data["terrain-modification"],
                clientToDeleteWith, null);
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
            session.AddEntityWithCanvasTransform(entityuuid, data.tag, "text", null,
                data.parent-uuid, data["position-percent"], data["size-percent"],
                null, entity.text, entity["font-size"],  clientToDeleteWith, null);
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
            session.AddEntityWithScale(entityuuid, data.tag, "voxel", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
            session.AddEntityWithSize(entityuuid, data.tag, "voxel", null,
                data["parent-uuid"], data.position, data.rotation, data.scale, null,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, true,
                { x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, false, 0, null,
                clientToDeleteWith, null);
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
                console.warn("Size Entity Message does not contain: size.y");
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

    function HandleModifyTerrainEntityMessage(session, data) {
        if (!data.hasOwnProperty("entity-id")) {
            console.warn("Modify Terrain Entity Message does not contain: entity-id");
            return;
        }
        if (!data.hasOwnProperty("modification")) {
            console.warn("Modify Terrain Entity Message does not contain: modification");
            return;
        }
        if (!data.hasOwnProperty("position")) {
            console.warn("Modify Terrain Entity Message does not contain: position");
            return;
        }
        else {
            if (!data.position.hasOwnProperty("x")) {
                console.warn("Modify Terrain Entity Message does not contain: position.x");
                return;
            }
            if (!data.position.hasOwnProperty("y")) {
                console.warn("Modify Terrain Entity Message does not contain: position.y");
                return;
            }
            if (!data.position.hasOwnProperty("z")) {
                console.warn("Modify Terrain Entity Message does not contain: position.z");
                return;
            }
        }
        if (!data.hasOwnProperty("brush-type")) {
            console.warn("Modify Terrain Entity Message does not contain: brush-type");
            return;
        }
        if (!data.hasOwnProperty("layer")) {
            console.warn("Modify Terrain Entity Message does not contain: layer");
            return;
        }
        if (!CanModifyTerrainEntity(data["client-id"], session.id)) {
            Log(`Client ${data["client-id"]} is not allowed to modify a terrain entity in session ${session.id}`);
            return;
        }
        session.ModifyTerrainEntity(data["entity-id"],
            data.modification, data.position, data["brush-type"], data.layer);
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
    this.CanCreateSession = function(clientID) {
        if (this.createSessionAuthCallback != null) {
            if (this.createSessionAuthCallback(clientID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanDestroySession Determine whether or not the client can destroy a session.
     * @param {*} clientID Client ID.
     * @returns Whether or not the client can destroy a session.
     */
    this.CanDestroySession = function(clientID) {
        if (this.destroySessionAuthCallback != null) {
            if (this.destroySessionAuthCallback(clientID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanJoinSession Determine whether or not the client can join a session.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can join a session.
     */
    this.CanJoinSession = function(clientID, sessionID) {
        if (this.joinSessionAuthCallback != null) {
            if (this.joinSessionAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanExitSession Determine whether or not the client can exit a session.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can exit a session.
     */
    this.CanExitSession = function(clientID, sessionID) {
        if (this.exitSessionAuthCallback != null) {
            if (this.exitSessionAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanGiveHeartbeat Determine whether or not the client can give a heartbeat.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can give a heartbeat.
     */
    this.CanGiveHeartbeat = function(clientID, sessionID) {
        if (this.giveHeartbeatAuthCallback != null) {
            if (this.GiveHeartbeatAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanGetSessionState Determine whether or not the client can get the session state.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can get the session state.
     */
    this.CanGetSessionState = function(clientID, sessionID) {
        if (this.getSessionStateAuthCallback != null) {
            if (this.getSessionStateAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateContainerEntity Determine whether or not the client can create a container entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a container entity.
     */
    function CanCreateContainerEntity(clientID, sessionID) {
        if (this.createContainerEntityAuthCallback != null) {
            if (this.createContainerEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateMeshEntity Determine whether or not the client can create a mesh entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a mesh entity.
     */
    function CanCreateMeshEntity(clientID, sessionID) {
        if (this.createMeshEntityAuthCallback != null) {
            if (this.createMeshEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateCharacterEntity Determine whether or not the client can create a character entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a character entity.
     */
    function CanCreateCharacterEntity(clientID, sessionID) {
        if (this.createCharacterEntityAuthCallback != null) {
            if (this.createCharacterEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateButtonEntity Determine whether or not the client can create a button entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a button entity.
     */
    function CanCreateButtonEntity(clientID, sessionID) {
        if (this.createButtonEntityAuthCallback != null) {
            if (this.createButtonEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateCanvasEntity Determine whether or not the client can create a canvas entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a canvas entity.
     */
    function CanCreateCanvasEntity(clientID, sessionID) {
        if (this.createCanvasEntityAuthCallback != null) {
            if (this.createCanvasEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateInputEntity Determine whether or not the client can create an input entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create an input entity.
     */
    function CanCreateInputEntity(clientID, sessionID) {
        if (this.createInputEntityAuthCallback != null) {
            if (this.createInputEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateLightEntity Determine whether or not the client can create a light entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a light entity.
     */
    function CanCreateLightEntity(clientID, sessionID) {
        if (this.createLightEntityAuthCallback != null) {
            if (this.createLightEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateTerrainEntity Determine whether or not the client can create a terrain entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a terrain entity.
     */
    function CanCreateTerrainEntity(clientID, sessionID) {
        if (this.createTerrainEntityAuthCallback != null) {
            if (this.createTerrainEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateTextEntity Determine whether or not the client can create a text entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a text entity.
     */
    function CanCreateTextEntity(clientID, sessionID) {
        if (this.createTextEntityAuthCallback != null) {
            if (this.createTextEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanCreateVoxelEntity Determine whether or not the client can create a voxel entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can create a voxel entity.
     */
    function CanCreateVoxelEntity(clientID, sessionID) {
        if (this.createVoxelEntityAuthCallback != null) {
            if (this.createVoxelEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanSendMessage Determine whether or not the client can send a message.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can send a message.
     */
    function CanSendMessage(clientID, sessionID) {
        if (this.sendMessageAuthCallback != null) {
            if (this.sendMessageAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanDeleteEntity Determine whether or not the client can delete an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can delete an entity.
     */
    function CanDeleteEntity(clientID, sessionID) {
        if (this.deleteEntityAuthCallback != null) {
            if (this.deleteEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanRemoveEntity Determine whether or not the client can remove an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can remove an entity.
     */
    function CanRemoveEntity(clientID, sessionID) {
        if (this.removeEntityAuthCallback != null) {
            if (this.removeEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanPositionEntity Determine whether or not the client can position an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can position an entity.
     */
    function CanPositionEntity(clientID, sessionID) {
        if (this.positionEntityAuthCallback != null) {
            if (this.positionEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanRotateEntity Determine whether or not the client can rotate an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can rotate an entity.
     */
    function CanRotateEntity(clientID, sessionID) {
        if (this.rotateEntityAuthCallback != null) {
            if (this.rotateEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanScaleEntity Determine whether or not the client can scale an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can scale an entity.
     */
    function CanScaleEntity(clientID, sessionID) {
        if (this.scaleEntityAuthCallback != null) {
            if (this.scaleEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanSizeEntity Determine whether or not the client can size an entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can size an entity.
     */
    function CanSizeEntity(clientID, sessionID) {
        if (this.sizeEntityAuthCallback != null) {
            if (this.sizeEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanModifyTerrainEntity Determine whether or not the client can modify a terrain entity.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can modify a terrain entity.
     */
    function CanModifyTerrainEntity(clientID, sessionID) {
        if (this.modifyTerrainEntityAuthCallback != null) {
            if (this.modifyTerrainEntityAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanSetEntityCanvasType Determine whether or not the client set an entity canvas type.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can set an entity canvas type.
     */
    function CanSetEntityCanvasType(clientID, sessionID) {
        if (this.setEntityCanvasTypeAuthCallback != null) {
            if (this.setEntityCanvasTypeAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

        return true;
    }

    /**
     * @function CanSetEntityHighlightState Determine whether or not the client can set an entity highlight state.
     * @param {*} clientID Client ID.
     * @param {*} sessionID Session ID
     * @returns Whether or not the client can set an entity highlight state.
     */
    function CanSetEntityHighlightState(clientID, sessionID) {
        if (this.setEntityHighlightStateAuthCallback != null) {
            if (this.setEntityHighlightStateAuthCallback(clientID, sessionID) != true) {
                return false;
            }
        }

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