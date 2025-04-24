import mongoose from 'mongoose';

const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: { type: String },
  genres: [String],
  coverImage: { type: String },
  slug: { type: String, unique: true },
  audioFileUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const TrackModel = mongoose.model('Track', TrackSchema);
