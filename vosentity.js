module.exports = function(uuid, tag, type, path, parent,
    position, rotation, scalesize, isSize, isSizePercent,
    resources, onClickEvent, length, width, height, heights,
    text, fontSize) {
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
        this.text = text;
        this.fontSize = fontSize;
        this.angularVelocity = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.stationary = true;
        this.angularDrag = 0;
        this.centerOfMass = { x: 0, y: 0, z: 0 };
        this.drag = 0;
        this.gravitational = false;
        this.mass = 0;
};