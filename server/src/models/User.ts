import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  avatarColor: string;
}

interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;
export type UserDoc = HydratedDocument<IUser, IUserMethods>;

const COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#10B981', '#EF4444', '#EAB308', '#EC4899', '#14B8A6'];

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatarColor: { type: String, default: () => COLORS[Math.floor(Math.random() * COLORS.length)] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = model<IUser, UserModel>('User', userSchema);
