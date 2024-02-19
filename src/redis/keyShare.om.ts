import { Repository, Schema } from "redis-om";
import { keys_client } from "./keys.client";

export const keyShareSchema = new Schema("key-share", {
    userId: { type: 'string' },
    mpcId: { type: 'string' },
    mpcPk: { type: 'string' },
    expAt: { type: 'number' },
    share: { type: 'string' }
});

export const keyShareRepository = new Repository(keyShareSchema, keys_client);

await keyShareRepository.createIndex();
