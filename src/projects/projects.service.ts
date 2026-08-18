import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@InjectModel(Project.name) private projectModel: Model<ProjectDocument>) {}

  async findAll(userId: string): Promise<ProjectDocument[]> {
    return this.projectModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, userId: string): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(id).exec();
    if (!project) throw new NotFoundException(`Project "${id}" not found`);
    if (project.userId !== userId) throw new ForbiddenException('Access denied');
    return project;
  }

  async create(dto: CreateProjectDto, userId: string): Promise<ProjectDocument> {
    const project = new this.projectModel({ ...dto, userId });
    return project.save();
  }

  async update(id: string, dto: UpdateProjectDto, userId: string): Promise<ProjectDocument> {
    await this.findOne(id, userId);
    const project = await this.projectModel.findByIdAndUpdate(id, dto, { returnDocument: 'after' }).exec();
    if (!project) throw new NotFoundException(`Project "${id}" not found`);
    return project;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.projectModel.findByIdAndDelete(id).exec();
  }
}
