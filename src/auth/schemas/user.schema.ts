import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ default: true })
  isGuest: boolean;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  username: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
