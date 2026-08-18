import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async findAll(userId: string): Promise<TaskDocument[]> {
    return this.taskModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }
    if (task.userId !== userId) {
      throw new ForbiddenException('You do not have access to this task');
    }
    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<TaskDocument> {
    const task = new this.taskModel({
      ...createTaskDto,
      userId,
    });
    return task.save();
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<TaskDocument> {
    // Verify ownership first
    await this.findOne(id, userId);

    const task = await this.taskModel
      .findByIdAndUpdate(id, updateTaskDto, { returnDocument: 'after' })
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }
    return task;
  }

  async remove(id: string, userId: string): Promise<void> {
    // Verify ownership first
    await this.findOne(id, userId);
    await this.taskModel.findByIdAndDelete(id).exec();
  }
}
