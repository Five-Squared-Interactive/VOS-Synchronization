// Copyright (c) 2019-2024 Five Squared Interactive. All rights reserved.

/**
 * @module vosClient A VOS Client.
 * @param {*} uuid UUID.
 * @param {*} tag Tag.
 */
module.exports = function(uuid, tag) {
        this.uuid = uuid;
        this.tag = tag;
        this.lastHeartbeat = Date.now();
        this.entitiesToDestroyOnExit = [];
};