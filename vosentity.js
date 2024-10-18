// Copyright (c) 2019-2024 Five Squared Interactive. All rights reserved.

/**
 * @module vosEntity A VOS Entity.
 * @param {*} uuid UUID.
 * @param {*} tag Tag.
 * @param {*} type Type.
 * @param {*} path Path.
 * @param {*} parent Parent.
 * @param {*} position Position.
 * @param {*} rotation Rotation.
 * @param {*} scalesize Scale/Size.
 * @param {*} isSize Is Size.
 * @param {*} isSizePercent Is Size Percent.
 * @param {*} resources Resources.
 * @param {*} onClickEvent On Click Event.
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
 */
module.exports = function(uuid, tag, type, path, parent,
    position, rotation, scalesize, isSize, isSizePercent,
    resources, onClickEvent, length, width, height, heights,
    diffuseTextures, normalTextures, maskTextures, specularValues,
    metallicValues, smoothnessValues, layerMask, subType,
    text, fontSize, angularVelocity, velocity, stationary,
    angularDrag, centerOfMass, drag, gravitational, mass,
    terrainModifications, modelOffset, modelRotation, labelOffset) {
        this.uuid = uuid;
        this.tag = tag;
        this.type = type;
        this.path = path;
        this.parent = parent;
        this.visible = false;
        this.position = position;
        this.rotation = rotation;
        this.scalesize = scalesize;
        this.isSize = isSize;
        this.isSizePercent = isSizePercent;
        this.resources = resources;
        this.canvasType = "world";
        this.onClickEvent = onClickEvent;
        this.length = length;
        this.width = width;
        this.height = height;
        this.heights = heights;
        this.diffuseTextures = diffuseTextures;
        this.normalTextures = normalTextures;
        this.maskTextures = maskTextures;
        this.specularValues = specularValues;
        this.metallicValues = metallicValues;
        this.smoothnessValues = smoothnessValues;
        this.layerMask = layerMask;
        this.subType = subType;
        this.text = text;
        this.fontSize = fontSize;
        this.angularVelocity = angularVelocity;
        this.velocity = velocity;
        this.stationary = stationary;
        this.angularDrag = angularDrag;
        this.centerOfMass = centerOfMass;
        this.drag = drag;
        this.gravitational = gravitational;
        this.mass = mass;
        this.terrainModifications = terrainModifications;
        this.modelOffset = modelOffset;
        this.modelRotation = modelRotation;
        this.labelOffset = labelOffset;
};