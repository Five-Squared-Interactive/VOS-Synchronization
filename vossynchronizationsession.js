// Copyright (c) 2019-2024 Five Squared Interactive. All rights reserved.

const vosClient = require("./vosclient.js");
const vosEntity = require("./vosentity.js");
const uuid = require("uuid");

/**
 * @module VOSSynchronizationSession VOS Synchronization Session.
 * @param {*} id ID.
 * @param {*} tag Tag.
 */
module.exports = function(id, tag) {
    /**
     * Clients.
     */
    this.clients = [];

    /**
     * Entities.
     */
    this.entities = [];

    /**
     * ID.
     */
    this.id = id;

    /**
     * Tag.
     */
    this.tag = tag;

    /**
     * @function AddClient Add a Client.
     * @param {*} clientID Client ID.
     * @param {*} clientTag Client Tag.
     */
    this.AddClient = function(clientID, clientTag) {
        for (client in this.clients) {
            if (client.uuid == clientID) {
                console.warn(`[VOSSynchronizationSession->AddClient] Duplicate clientID: ${clientID}. Skipping`);
                return;
            }
        }
        let newClient = new vosClient(clientID, clientTag);
        this.clients.push(newClient);
    }

    /**
     * @function RemoveClient Remove a Client.
     * @param {*} clientID Client ID.
     */
    this.RemoveClient = function(clientID) {
        this.clients.forEach(client => {
            if (client.uuid == clientID) {
                index = this.clients.indexOf(client);
                if (index > -1) {
                    this.clients[index].entitiesToDestroyOnExit.forEach(entity => {
                        this.RemoveEntity(entity);
                    });
                    this.clients.splice(index, 1);
                }
                return;
            }
            console.warn(`[VOSSynchronizationSession->RemoveClient] ClientID: ${clientID} does not exist`);
        });
    }

    /**
     * @function AddEntityWithScale Add an Entity with a Scale.
     * @param {*} id ID.
     * @param {*} tag Tag.
     * @param {*} type Type.
     * @param {*} path Path.
     * @param {*} parent Parent.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} scale Scale.
     * @param {*} resources Resources.
     * @param {*} length Length.
     * @param {*} width Width.
     * @param {*} height Height.
     * @param {*} heights Heights.
     * @param {*} diffuseTextures Diffuse Textures.
     * @param {*} normalTextures Normal Textures.
     * @param {*} maskTextures Mask Textures.
     * @param {*} specularValues Specular Values.
     * @param {*} metallicValues Metallic Values.
     * @param {*} smoothnessValues Smoothness Values.
     * @param {*} layerMask Layer Mask.
     * @param {*} subType Sub-Type.
     * @param {*} text Text.
     * @param {*} fontSize Font Size.
     * @param {*} angularVelocity Angular Velocity.
     * @param {*} velocity Velocity.
     * @param {*} stationary Stationary.
     * @param {*} angularDrag Angular Drag.
     * @param {*} centerOfMass Center of Mass.
     * @param {*} drag Drag.
     * @param {*} gravitational Gravitational.
     * @param {*} mass Mass.
     * @param {*} terrainModifications Terrain Modifications.
     * @param {*} modelOffset Model Offset.
     * @param {*} modelRotation Model Rotation.
     * @param {*} labelOffset Label Offset.
     * @param {*} clientToDeleteWith Client to Delete With.
     * @param {*} onClickEvent On Click Event.
     */
    this.AddEntityWithScale = function(id, tag, type, path, parent, position,
        rotation, scale, resources, length, width, height, heights,
        diffuseTextures, normalTextures, maskTextures, specularValues,
        metallicValues, smoothnessValues, layerMask, subType,
        text, fontSize, angularVelocity, velocity, stationary,
        angularDrag, centerOfMass, drag, gravitational, mass,
        terrainModifications, modelOffset, modelRotation, labelOffset,
        clientToDeleteWith, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithScale] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, position,
            rotation, scale, false, false, resources, onClickEvent, length, width, height, heights,
            diffuseTextures, normalTextures, maskTextures, specularValues, metallicValues, smoothnessValues,
            layerMask, subType, text, fontSize, angularVelocity, velocity, stationary, angularDrag, centerOfMass,
            drag, gravitational, mass, terrainModifications, modelOffset, modelRotation, labelOffset);
        this.entities.push(newEntity);
        this.clients.forEach(client => {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        });
    }

    /**
     * @function AddEntityWithSize Add an Entity with a Size.
     * @param {*} id ID.
     * @param {*} tag Tag.
     * @param {*} type Type.
     * @param {*} path Path.
     * @param {*} parent Parent.
     * @param {*} position Position.
     * @param {*} rotation Rotation.
     * @param {*} size Size.
     * @param {*} resources Resources.
     * @param {*} length Length.
     * @param {*} width Width.
     * @param {*} height Height.
     * @param {*} heights Heights.
     * @param {*} diffuseTextures Diffuse Textures.
     * @param {*} normalTextures Normal Textures.
     * @param {*} maskTextures Mask Textures.
     * @param {*} specularValues Specular Values.
     * @param {*} metallicValues Metallic Values.
     * @param {*} smoothnessValues Smoothness Values.
     * @param {*} layerMask Layer Mask.
     * @param {*} subType Sub-Type.
     * @param {*} text Text.
     * @param {*} fontSize Font Size.
     * @param {*} angularVelocity Angular Velocity.
     * @param {*} velocity Velocity.
     * @param {*} stationary Stationary.
     * @param {*} angularDrag Angular Drag.
     * @param {*} centerOfMass Center of Mass.
     * @param {*} drag Drag.
     * @param {*} gravitational Gravitational.
     * @param {*} mass Mass.
     * @param {*} terrainModifications Terrain Modifications.
     * @param {*} modelOffset Model Offset.
     * @param {*} modelRotation Model Rotation.
     * @param {*} labelOffset Label Offset.
     * @param {*} clientToDeleteWith Client to Delete With.
     * @param {*} onClickEvent On Click Event.
     */
    this.AddEntityWithSize = function(id, tag, type, path, parent, position,
        rotation, size, resources, length, width, height, heights,
        diffuseTextures, normalTextures, maskTextures, specularValues,
        metallicValues, smoothnessValues, layerMask, subType, text, fontSize,
        angularVelocity, velocity, stationary, angularDrag, centerOfMass, drag,
        gravitational, mass, terrainModifications, modelOffset, modelRotation, labelOffset,
        clientToDeleteWith, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithSize] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, position,
            rotation, size, true, false, resources, onClickEvent, length, width, height, heights,
            diffuseTextures, normalTextures, maskTextures, specularValues, metallicValues, smoothnessValues,
            layerMask, subType, text, fontSize, angularVelocity, velocity, stationary, angularDrag, centerOfMass,
            drag, gravitational, mass, terrainModifications, modelOffset, modelRotation, labelOffset);
        this.entities.push(newEntity);
        for (client in this.clients) {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        }
    }

    /**
     * @function AddEntityWithCanvasTransform Add an Entity with a Canvas Transform.
     * @param {*} id ID.
     * @param {*} tag Tag.
     * @param {*} type Type.
     * @param {*} path Path.
     * @param {*} parent Parent.
     * @param {*} positionPercent Position Percent.
     * @param {*} sizePercent Size Percent.
     * @param {*} subType Sub-Type.
     * @param {*} text Text.
     * @param {*} fontSize Font Size.
     * @param {*} clientToDeleteWith Client to Delete With.
     * @param {*} onClickEvent On Click Event.
     */
    this.AddEntityWithCanvasTransform = function(id, tag, type, path, parent, positionPercent,
        sizePercent, subType, text, fontSize, clientToDeleteWith, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithCanvasTransform] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, positionPercent,
            null, sizePercent, false, true, resources, onClickEvent, null, null, null, null,
            null, null, null, null, null, null,
            null, subType, text, fontSize, null, null, null, null, null, null, null, null, null, null, null, null);
        this.entities.push(newEntity);
        for (client in this.clients) {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        }
    }

    /**
     * @function RemoveEntity Remove an Entity.
     * @param {*} id ID.
     */
    this.RemoveEntity = function(id) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                index = this.entities.indexOf(entity);
                if (index > -1) {
                    this.entities.splice(index, 1);
                }
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->RemoveEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function ParentEntity Parent an Entity.
     * @param {*} id ID.
     * @param {*} parent Parent.
     */
    this.ParentEntity = function(id, parent) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.parent = parent;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->ParentEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function SetVisibility Set an Entity's Visibility.
     * @param {*} id ID.
     * @param {*} visible Visibility.
     */
    this.SetVisibility = function(id, visible) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.visible = visible;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetVisibility] Entity: ${id} does not exist`);
    }

    /**
     * @function PositionEntity Position an Entity.
     * @param {*} id ID.
     * @param {*} position Position.
     */
    this.PositionEntity = function(id, position) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.position = position;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->PositionEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function RotateEntity Rotate an Entity.
     * @param {*} id ID.
     * @param {*} rotation Rotation.
     */
    this.RotateEntity = function(id, rotation) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.rotation = rotation;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->RotateEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function ScaleEntity Scale an Entity.
     * @param {*} id ID.
     * @param {*} scale Scale.
     */
    this.ScaleEntity = function(id, scale) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.scale = scale;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->ScaleEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function SizeEntity Size an Entity.
     * @param {*} id ID.
     * @param {*} size Size.
     */
    this.SizeEntity = function(id, size) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.size = size;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SizeEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function SizeEntity Modify a Terrain Entity.
     * @param {*} id ID.
     * @param {*} mod Modification.
     * @param {*} pos Position.
     * @param {*} bt Brush Type.
     * @param {*} lyr Layer.
     */
    this.ModifyTerrainEntity = function(id, mod, pos, bt, lyr) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.terrainModifications.push({
                    modification: mod,
                    position: pos,
                    brushType: bt,
                    layer: lyr
                });
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SizeEntity] Entity: ${id} does not exist`);
    }

    /**
     * @function SetCanvasType Set a Canvas Type.
     * @param {*} id ID.
     * @param {*} type Type.
     */
    this.SetCanvasType = function(id, type) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity["canvas-type"] = type;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetCanvasType] Entity: ${id} does not exist`);
    }

    /**
     * @function SetHighlightState Set an Entity's Highlight State.
     * @param {*} id ID.
     * @param {*} highlighted Highlight State.
     */
    this.SetHighlightState = function(id, highlighted) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.highlighted = highlighted;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetHighlightState] Entity: ${id} does not exist`);
    }

    /**
     * @function SetMotionState Set an Entity's Motion State.
     * @param {*} id ID.
     * @param {*} angularVelocity Angular Velocity.
     * @param {*} velocity Velocity.
     * @param {*} stationary Stationary.
     */
    this.SetMotionState = function(id, angularVelocity, velocity, stationary) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.angularVelocity = angularVelocity;
                entity.velocity = velocity;
                entity.stationary = stationary;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetMotionState] Entity: ${id} does not exist`);
    }

    /**
     * @function SetPhysicalState Set an Entity's Physical State.
     * @param {*} id ID.
     * @param {*} angularDrag Angular Drag.
     * @param {*} centerOfMass Center of Mass.
     * @param {*} drag Drag.
     * @param {*} gravitational Gravitational.
     * @param {*} mass Mass.
     */
    this.SetPhysicalState = function(id, angularDrag, centerOfMass, drag, gravitational, mass) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.angularDrag = angularDrag;
                entity.centerOfMass = centerOfMass;
                entity.drag = drag;
                entity.gravitational = gravitational;
                entity.mass = mass;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetPhysicalState] Entity: ${id} does not exist`);
    }

    /**
     * @function UpdateHeartbeat Update the Hearbeat.
     * @param {*} clientID Client ID for the Client to update the Heartbeat for.
     */
    this.UpdateHeartbeat = function(clientID) {
        this.clients.forEach(client => {
            if (client.uuid == clientID) {
                index = this.clients.indexOf(client);
                if (index > -1) {
                    this.clients[index].lastHeartbeat = Date.now();
                }
                return;
            }
            //console.warn(`[VOSSynchronizationSession->UpdateHeartbeat] ClientID: ${clientID} does not exist`);
        });
    }
};