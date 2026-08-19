import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, maxlength: 200 })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['urgent', 'high', 'medium', 'low', 'no_priority'],
    default: 'no_priority',
  })
  priority: string;

  @Prop({ default: '' })
  lead: string;

  @Prop({
    type: String,
    enum: ['todo', 'doing', 'completed'],
    default: 'todo',
  })
  status: string;

  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ required: true })
  userId: string;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ userId: 1 });
