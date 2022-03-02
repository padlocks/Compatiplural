const memberSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        desc: { type: "string" },
        pronouns: { type: "string" },
        pkId: { type: "string" },
        color: { type: "string" },
        avatarUuid: { type: "string" },
        avatarUrl: { type: "string" },
        private: { type: "boolean" },
        preventTrusted: { type: "boolean" },
        preventFrontNotifs: { type: "boolean" },
        info: {
            type: "object",
            properties: {
                "*": { type: "string" }
            }
        }
    },
    nullable: false,
    additionalProperties: false,
};

const groupSchema = {
    type: "object",
    properties: {
        parent: { type: "string" },
        color: { type: "string" },
        private: { type: "boolean" },
        preventTrusted: { type: "boolean" },
        name: { type: "string" },
        desc: { type: "string" },
        emoji: { type: "string" },
        members: { type: "array", items: { type: "string" } },
    },
    nullable: false,
    additionalProperties: false,
    dependencies: {
        private: { required: ["preventTrusted"] },
        preventTrusted: { required: ["private"] },
    }
};

const customFrontSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        desc: { type: "string" },
        avatarUrl: { type: "string" },
        avatarUuid: { type: "string" },
        color: { type: "string" },
        preventTrusted: { type: "boolean" },
        private: { type: "boolean" },
    },
    nullable: false,
    additionalProperties: false,
}

const commentSchema = {
    type: "object",
    properties: {
        time: { type: "number" },
        text: { type: "string" },
        documentId: { type: "string" },
        collection: { type: "string" }
    },
    nullable: false,
    additionalProperties: false,
    required: ["time", "text", "documentId", "collection"]
}

const commentPatchSchema = {
    type: "object",
    properties: {
        text: { type: "string" },
    },
    nullable: false,
    additionalProperties: false,
    required: ["text"]
}

const automatedTimerSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        message: { type: "string" },
        action: { type: "number" },
        delayInHours: { type: "number" },
        type: { type: "number" },
    },
    nullable: false,
    additionalProperties: false,
};


module.exports = {
    memberSchema,
    groupSchema
}