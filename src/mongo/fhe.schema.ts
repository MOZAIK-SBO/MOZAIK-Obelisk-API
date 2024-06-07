import mongoose, { Schema } from "mongoose";


const fheIngestSchema = new Schema(
  {
    ts: { type: Date, required: true },
    metric: { type: String, required: true },
    source: { type: String, required: true },

    c: { type: String, required: true }
  },
  {
    timeseries: {
      timeField: 'ts',
    },
    virtuals: {
      timestamp: {
        get() {
          return this.ts.getTime();
        }
      }
    },
    toJSON: { virtuals: true },
    collection: 'fhe-ecg-encrypted-ds'
  }
);


interface FheResultValue {
  is_combined: boolean;
  c_result: string;
  analysis_id: string;
}

const fheResultSchema = new Schema(
  {
    ts: { type: Date, required: true },
    metric: { type: String, required: true },
    source: { type: String, required: true },

    value: new Schema<FheResultValue>({
      is_combined: { type: Boolean, default: true },
      c_result: { type: String, required: true },
      analysis_id: { type: String, required: true }
    })
  },
  {
    timeseries: {
      timeField: 'ts',
    },
    virtuals: {
      timestamp: {
        get() {
          return this.ts.getTime();
        }
      }
    },
    toJSON: { virtuals: true },
    collection: 'fhe-ecg-results-ds'
  }
);

export const FheResult = mongoose.model("FheResult", fheResultSchema);
export const FheEvent = mongoose.model("FheEvent", fheIngestSchema);

FheResult.createIndexes();
FheEvent.createIndexes();

