const vosClient = require("./vosclient.js");
const vosEntity = require("./vosentity.js");
const uuid = require("uuid");

module.exports = function(id, tag) {
    this.clients = [];
    this.entities = [];
    this.id = id;
    this.tag = tag;

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

    this.AddEntityWithScale = function(id, tag, type, path, parent, position,
        rotation, scale, resources, length, width, height, heights, text, fontSize,
        clientToDeleteWith, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithScale] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, position,
            rotation, scale, false, false, resources, onClickEvent, length, width, height, heights, text, fontSize);
        this.entities.push(newEntity);
        this.clients.forEach(client => {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        });
    }

    this.AddEntityWithSize = function(id, tag, type, path, parent, position,
        rotation, size, resources, length, width, height, heights, text, fontSize,
        clientToDeleteWith, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithSize] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, position,
            rotation, size, true, false, resources, onClickEvent, length, width, height, heights, text, fontSize);
        this.entities.push(newEntity);
        for (client in this.clients) {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        }
    }

    this.AddEntityWithCanvasTransform = function(id, tag, type, path, parent, positionPercent,
        sizePercent, clientToDeleteWith, length, width, height, heights, onClickEvent) {
        for (entity in this.entities) {
            if (entity.uuid == id) {
                console.warn(`[VOSSynchronizationSession->AddEntityWithCanvasTransform] Duplicate UUID: ${id}. Skipping`);
                return;
            }
        }
        let newEntity = new vosEntity(id, tag, type, path, parent, positionPercent,
            null, sizePercent, false, true, resources, onClickEvent, length, width, height, heights, text, fontSize);
        this.entities.push(newEntity);
        for (client in this.clients) {
            if (client.uuid == clientToDeleteWith) {
                client.entitiesToDestroyOnExit.push(id);
            }
        }
    }

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

    this.ParentEntity = function(id, parent) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.parent = parent;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->ParentEntity] Entity: ${id} does not exist`);
    }

    this.SetVisibility = function(id, visible) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.visible = visible;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetVisibility] Entity: ${id} does not exist`);
    }

    this.PositionEntity = function(id, position) {
        this.entities.forEach(entity => {
            if (uuid.parse(entity.uuid).toString() == uuid.parse(id).toString()) {
                entity.position = position;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->PositionEntity] Entity: ${id} does not exist`);
    }

    this.RotateEntity = function(id, rotation) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.rotation = rotation;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->RotateEntity] Entity: ${id} does not exist`);
    }

    this.ScaleEntity = function(id, scale) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.scale = scale;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->ScaleEntity] Entity: ${id} does not exist`);
    }

    this.SizeEntity = function(id, size) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.size = size;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SizeEntity] Entity: ${id} does not exist`);
    }

    this.SetCanvasType = function(id, type) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity["canvas-type"] = type;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetCanvasType] Entity: ${id} does not exist`);
    }

    this.SetHighlightState = function(id, highlighted) {
        this.entities.forEach(entity => {
            if (entity.uuid == id) {
                entity.highlighted = highlighted;
                return;
            }
        });
        //console.warn(`[VOSSynchronizationSession->SetHighlightState] Entity: ${id} does not exist`);
    }

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