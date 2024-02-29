import { Repository, Schema } from "redis-om";
import { keys_client } from "./keys.client";

const keyShareSchema = new Schema("key-share", {
    analysis_id: { type: 'string' },
    user_id: { type: 'string' },
    mpc_id: { type: 'string' },
    key_share: { type: 'string' },
    exp_at: { type: 'number' }
});

export const keyShareRepository = new Repository(keyShareSchema, keys_client);

await keyShareRepository.createIndex();
