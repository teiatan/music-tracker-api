import mongoose from 'mongoose';
import { Schema, model } from 'mongoose';
import streamifier from 'streamifier';
import cloudinary from '../lib/cloudinary';
import { Track, QueryParams, BatchDeleteResponse } from '../types';

export const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('❌ MONGODB_URI is not defined in .env');
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');
};

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Mongoose schema
const trackSchema = new Schema<Track>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: { type: String, default: '' },
  genres: { type: [String], default: [] },
  coverImage: { type: String, default: '' },
  audioFile: { type: String, default: '' },
  slug: { type: String, required: true, unique: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
});

const TrackModel = model<Track>('Track', trackSchema);

/**
 * Upload file to Cloudinary
 */
export const saveAudioFile = async (
  id: string,
  fileName: string,
  buffer: Buffer
): Promise<string> => {
  const streamUpload = () =>
    new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER || 'tracks',
          public_id: id,
          resource_type: 'video', // for mp3/wav
        },
        (error, result) => {
          if (result) resolve(result.secure_url);
          else reject(error);
        }
      );
      streamifier.createReadStream(buffer).pipe(stream);
    });

  return await streamUpload();
};

/**
 * Delete audio from Cloudinary
 */
export const deleteAudioFile = async (id: string): Promise<boolean> => {
  const track = await getTrackById(id);
  if (!track || !track.audioFile) return false;

  const publicId = `${process.env.CLOUDINARY_FOLDER || 'tracks'}/${id}`;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });

  await updateTrack(id, { audioFile: '' });
  return true;
};

/**
 * Create track
 */
export const createTrack = async (
  track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Track> => {
  const id = Date.now().toString();
  const now = new Date().toISOString();

  const newTrack = await TrackModel.create({
    ...track,
    id,
    createdAt: now,
    updatedAt: now,
  });

  return newTrack.toObject();
};

/**
 * Update track
 */
export const updateTrack = async (
  id: string,
  updates: Partial<Track>
): Promise<Track | null> => {
  const updated = await TrackModel.findOneAndUpdate(
    { id },
    { ...updates, updatedAt: new Date().toISOString() },
    { new: true }
  );
  return updated?.toObject() ?? null;
};

/**
 * Get track by slug
 */
export const getTrackBySlug = async (slug: string): Promise<Track | null> => {
  const track = await TrackModel.findOne({ slug });
  return track?.toObject() ?? null;
};

/**
 * Get track by ID
 */
export const getTrackById = async (id: string): Promise<Track | null> => {
  const track = await TrackModel.findOne({ id });
  return track?.toObject() ?? null;
};

/**
 * Get paginated, filtered, sorted tracks
 */
export const getTracks = async (params: QueryParams = {}) => {
  const {
    search = '',
    genre,
    artist,
    sort = 'createdAt',
    order = 'desc',
    page = 1,
    limit = 10,
  } = params;

  const filter: any = {};

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { title: regex },
      { artist: regex },
      { album: regex },
    ];
  }

  if (genre) filter.genres = genre;
  if (artist) filter.artist = new RegExp(artist, 'i');

  const total = await TrackModel.countDocuments(filter);
  const tracks = await TrackModel.find(filter)
    .sort({ [sort]: order === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { tracks, total };
};

/**
 * Delete track by ID
 */
export const deleteTrack = async (id: string): Promise<boolean> => {
  const track = await TrackModel.findOneAndDelete({ id });
  if (!track) return false;

  if (track.audioFile) {
    await deleteAudioFile(id);
  }

  return true;
};

/**
 * Delete many
 */
export const deleteMultipleTracks = async (ids: string[]): Promise<BatchDeleteResponse> => {
  const results: BatchDeleteResponse = { success: [], failed: [] };

  for (const id of ids) {
    const deleted = await deleteTrack(id);
    if (deleted) results.success.push(id);
    else results.failed.push(id);
  }

  return results;
};

/**
 * Static genres (as requested)
 */
export const getGenres = async (): Promise<string[]> => {
  return [
    'Rock', 'Pop', 'Hip Hop', 'Jazz', 'Classical', 'Electronic',
    'R&B', 'Country', 'Folk', 'Reggae', 'Metal', 'Blues', 'Indie',
  ];
};
