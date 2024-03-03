import { Repository, Schema } from "redis-om";
import { metadata_client } from "./metadata.client";


const mpcPartySchema = new Schema("mpc-parties", {
    mpc_id: { type: 'string' },
    host: { type: 'string' },
    region: { type: 'string' }
});

export const mpcPartyRepository = new Repository(mpcPartySchema, metadata_client);


const analysisSchema = new Schema("analyses", {
    user_id: { type: 'string' },
    user_key: { type: 'string' },
    source_dataset: { type: 'string' },
    result_dataset: { type: 'string' },
    metric: { type: 'string' },
    data_index: { type: 'number[]' },
    result_timestamps: { type: 'number[]' },
    parties: { type: 'string[]' },
    analysis_type: { type: 'string' },
    created_at: { type: 'number' },
    keys_exp_at: { type: 'number' }
});

export const analysisSchemaRepository = new Repository(analysisSchema, metadata_client);

await mpcPartyRepository.createIndex();
await analysisSchemaRepository.createIndex();
