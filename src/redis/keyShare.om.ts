import { Repository, Schema } from "redis-om";
import { keys_client } from "./keys.client";

const keyShareSchema = new Schema("key-share", {
    analysisId: { type: 'string' },
    userId: { type: 'string' },
    mpcId: { type: 'string' },
    keyShare: { type: 'string' },
    expAt: { type: 'number' }
});

export const keyShareRepository = new Repository(keyShareSchema, keys_client);

await keyShareRepository.createIndex();
