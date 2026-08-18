import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  TODO = 'todo',
  DOING = 'doing',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
}

export enum TaskPriority {
  NO_PRIORITY = 'no_priority',
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Prop({
    type: String,
    enum: Object.values(TaskPriority),
    default: TaskPriority.NO_PRIORITY,
  })
  priority: TaskPriority;

  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ type: [String], default: [] })
  labels: string[];

  @Prop({ default: '' })
  assignee: string;

  @Prop({ required: true })
  userId: string;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Index for faster queries by userId
TaskSchema.index({ userId: 1 });
TaskSchema.index({ userId: 1, status: 1 });
