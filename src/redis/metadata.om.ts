import { Repository, Schema } from "redis-om";
import { metadata_client } from "./metadata.client";


const mpcPartySchema = new Schema("mpc-parties", {
    mpcId: { type: 'string' },
    host: { type: 'string' },
    region: { type: 'string' }
});

export const mpcPartyRepository = new Repository(mpcPartySchema, metadata_client);


const analysisSchema = new Schema("analyses", {
    userId: { type: 'string' },
    userPk: { type: 'string' },
    sourceDataset: { type: 'string' },
    resultDataset: { type: 'string' },
    fromTimestamp: { type: 'number' },
    toTimestamp: { type: 'number' },
    parties: { type: 'string[]' },
    analysisType: { type: 'string' },
    createdAt: { type: 'number' },
    keysExpAt: { type: 'number' }
});

export const analysisSchemaRepository = new Repository(analysisSchema, metadata_client);

await mpcPartyRepository.createIndex();
await analysisSchemaRepository.createIndex();

