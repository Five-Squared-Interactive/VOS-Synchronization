module.exports = function(uuid, tag) {
        this.uuid = uuid;
        this.tag = tag;
        this.lastHeartbeat = Date.now();
        this.entitiesToDestroyOnExit = [];
};