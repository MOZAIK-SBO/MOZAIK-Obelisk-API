import mongoose from "mongoose";


mongoose.connect(process.env.MONGO_FHE_URL ?? "mongodb://localhost:27017")
  .then(() => console.log("Connected to FHE MongoDB"))
  .catch((err) => console.error(err));

